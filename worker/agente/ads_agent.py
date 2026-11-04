"""Agente de anúncios — pega jobs de public.mk_ad_jobs e entrega o pacote completo.

Roda junto do worker da máquina:
    cd worker && python3 agente/ads_agent.py            # fica ouvindo a fila
    python3 agente/ads_agent.py --once                  # processa a fila e sai
    python3 agente/ads_agent.py --job <uuid>            # processa um job específico

Variáveis (worker/.env):
    SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY             (ou SUPABASE_ANON_KEY + SUPABASE_EMAIL + SUPABASE_PASSWORD de um admin)
    ELEVENLABS_API_KEY / ELEVENLABS_VOICE_ID             (opcional: locução humana no vídeo; sem chave usa edge-tts)
    higgsfield CLI logado no PATH                        (opcional: cenas de uso com IA a partir da foto do produto)

Etapas (as mesmas de lib/marketplace/catalog.ts AGENT_STEPS):
  dados → lacunas → foto → cenas → textos → duvidas → video → validacao → pacote
Nada é inventado: textos e atributos saem do cadastro do Odoo; o que falta vira aviso.
"""
import io
import json
import os
import re
import shutil
import ssl
import subprocess
import sys
import tempfile
import time
import traceback
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from datetime import datetime, timezone

from PIL import Image

from ingest import product_from_draft, run_ingest  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "scripts", "anuncios"))
sys.path.insert(0, os.path.join(ROOT, "worker", "pipeline_py"))

CTX = ssl.create_default_context(cafile=os.environ.get("SSL_CERT_FILE") or None)
HIGGS_IMG_CREDITS = 2.75  # gpt_image_2_5 2K high (medido)
VIDEO_MAX = 5 * 1024 * 1024


# ----------------------------------------------------------------------------- env / Supabase
def load_env():
    p = os.path.join(ROOT, "worker", ".env")
    if os.path.exists(p):
        for line in open(p, encoding="utf-8"):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"'))


class Supa:
    def __init__(self):
        self.base = os.environ["SUPABASE_URL"].rstrip("/")
        self.user_id, self.user_email = None, "agente"
        if os.environ.get("SUPABASE_SERVICE_ROLE_KEY"):
            self.apikey = self.bearer = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
        else:
            self.apikey = os.environ["SUPABASE_ANON_KEY"]
            self.refresh_token, self.expires_at = None, 0
            self._login()

    def _login(self):
        """Login por senha (1ª vez) ou renovação pelo refresh_token (o access token do Supabase expira em ~1 h)."""
        if self.refresh_token:
            try:
                tok = self._req("POST", "/auth/v1/token?grant_type=refresh_token",
                                {"refresh_token": self.refresh_token}, auth=False)
            except Exception:
                tok = None
        else:
            tok = None
        if not tok:
            tok = self._req("POST", "/auth/v1/token?grant_type=password",
                            {"email": os.environ["SUPABASE_EMAIL"], "password": os.environ["SUPABASE_PASSWORD"]}, auth=False)
        self.bearer, self.user_id, self.user_email = tok["access_token"], tok["user"]["id"], tok["user"]["email"]
        self.refresh_token = tok.get("refresh_token")
        self.expires_at = time.time() + int(tok.get("expires_in") or 3600)

    def _ensure_token(self):
        if getattr(self, "refresh_token", None) is not None or getattr(self, "expires_at", None):
            if time.time() > self.expires_at - 120:
                self._login()

    def _req(self, method, path, body=None, auth=True, headers=None, raw=None, ctype="application/json", _retry=True):
        if auth:
            self._ensure_token()
        try:
            return self._req_once(method, path, body, auth, headers, raw, ctype)
        except urllib.error.HTTPError as e:
            if auth and _retry and e.code == 401 and getattr(self, "expires_at", None):
                self.expires_at = 0
                self._ensure_token()
                return self._req_once(method, path, body, auth, headers, raw, ctype)
            raise

    def _req_once(self, method, path, body, auth, headers, raw, ctype):
        h = {"apikey": self.apikey, "Content-Type": ctype}
        if auth:
            h["Authorization"] = f"Bearer {self.bearer}"
        h.update(headers or {})
        data = raw if raw is not None else (json.dumps(body, ensure_ascii=False).encode() if body is not None else None)
        req = urllib.request.Request(self.base + path, data, h, method=method)
        with urllib.request.urlopen(req, context=CTX, timeout=180) as r:
            txt = r.read()
        return json.loads(txt) if txt and r.headers.get("Content-Type", "").startswith("application/json") else None

    def select(self, table, query):
        return self._req("GET", f"/rest/v1/{table}?{query}")

    def patch(self, table, query, body, ret=False):
        return self._req("PATCH", f"/rest/v1/{table}?{query}", body,
                         headers={"Prefer": "return=representation" if ret else "return=minimal"})

    def insert_ret(self, table, body):
        return self._req("POST", f"/rest/v1/{table}", body, headers={"Prefer": "return=representation"})

    def download(self, bucket, path):
        """Arquivo de bucket privado (a RLS do Storage vale para o token do agente)."""
        return self._req_raw("GET", f"/storage/v1/object/{bucket}/{urllib.parse.quote(path)}")

    def _req_raw(self, method, path):
        self._ensure_token()
        req = urllib.request.Request(self.base + path, None, {"apikey": self.apikey, "Authorization": f"Bearer {self.bearer}"}, method=method)
        with urllib.request.urlopen(req, context=CTX, timeout=180) as r:
            return r.read()

    def insert(self, table, body):
        return self._req("POST", f"/rest/v1/{table}", body, headers={"Prefer": "return=minimal"})

    def upload(self, bucket, path, data, ctype):
        self._req("POST", f"/storage/v1/object/{bucket}/{path}", raw=data, ctype=ctype, headers={"x-upsert": "true"})
        return f"{self.base}/storage/v1/object/public/{bucket}/{path}"

    def audit(self, action, entity, entity_id, summary, details=None, company=None):
        try:
            self.insert("mk_audit_events", {"actor_id": self.user_id, "actor_email": self.user_email, "action": action,
                                            "entity": entity, "entity_id": str(entity_id), "summary": summary,
                                            "details": details or {}, "company_id": company or getattr(self, "company", None)})
        except Exception as e:  # auditoria não derruba o job
            print("[audit] falhou:", e)


# ----------------------------------------------------------------------------- textos (regras TikTok Shop)
STOP = {"a", "o", "as", "os", "um", "uma", "e", "ou", "de", "da", "do", "das", "dos", "em", "na", "no", "para", "por",
        "com", "sem", "até", "mm", "cm", "kg", "g", "ml", "l", "mm/s", "un"}
COLOR_WORDS = r"(preto|preta|branco|branca|cinza|azul|vermelho|vermelha|verde|amarelo|amarela|roxo|roxa|rosa|laranja|dourado|dourada|prata|cobre|transparente|marrom|bege|lavanda|camomila)"


def title_case(s):
    out = []
    for w in s.split():
        if w.lower() in STOP or re.match(r"^[0-9]", w) or (w.isupper() and len(w) > 1):
            out.append(w if not w.lower() in STOP else w.lower())
        else:
            out.append(w[0].upper() + w[1:])
    if out:
        out[0] = out[0][0].upper() + out[0][1:]
    return " ".join(out)


# Traduções automáticas ruins do Odoo -> termo de mercado (só o nome do anúncio; o Odoo não é alterado)
NAME_FIXES = [
    (r"^(kit de )?(consumíveis|suprimentos|materiais|material)( de| para)? impressão 3d( rápida)?( em)?", "Filamento para impressão 3D"),
    (r"^(bandeja|cabo|fibra|papel|filtro de fiapos)( de| para)?( material| impressão 3d)?( de| para)?( impressão 3d)?", "Filamento"),
    (r"^kit de impressão 3d", "Filamento para impressão 3D"),
    (r"^caixa de avião em bandeja de papel", "Filamento"),
    (r",?\s*preta,?(?=\s*caixa)", ""),
    (r",?\s*(caixa|disco|carretel) (preta e branca|preto neutro|de papelão ecológica|de papel ecológico)", ""),
    (r"\bcom bandeja\b", "com carretel"), (r"\bsem bandeja\b", "sem carretel"),
    (r"\bdiâmetro do (fio|filamento) de\b", "diâmetro"), (r"\bfio de 1,75", "1,75"),
    (r"\bpacote de 1\s?kg\b", "1 kg"), (r"\bsem fiapos( e)?\b", ""), (r"\bda (Creatorally|SUNLU|Creality)\b", r"\1"),
]


FILAMENT_RX = re.compile(r"filament|\b(pla|petg|abs|tpu|asa|silk)\b", re.I)


def is_filament(p):
    """Só trata como filamento se a categoria (ou, sem categoria, o nome) indicar filamento."""
    cat = (p.get("category") or "")
    return bool(FILAMENT_RX.search(cat)) if cat else bool(FILAMENT_RX.search(p.get("name_pt") or ""))


def pref(p):
    """Identificador do produto no anúncio: odoo-<id> (Kairós) ou prod-<rascunho> (empresas padrão)."""
    return p.get("ref") or f"odoo-{p['odoo_id']}"


def pcode(p):
    return p.get("sku") or (str(p["odoo_id"]) if p.get("odoo_id") else p.get("ref", ""))


def clean_name(name, filament=True):
    n = name
    # as 4 primeiras regras trocam o começo do nome por "Filamento": só valem para filamento
    fixes = NAME_FIXES if filament else NAME_FIXES[4:]
    for rx, rep in fixes:
        n = re.sub(rx, rep, n, flags=re.I)
    n = re.sub(r"\s{2,}", " ", re.sub(r"\s+,", ",", n)).strip(" ,")
    return n[0].upper() + n[1:] if n else name


def split_color(name):
    m = re.search(r"\s[–-]\s*([^–-]+)$", name) or re.search(r"\(([^)]+)\)\s*$", name)
    if m and re.search(COLOR_WORDS, m.group(1), re.I):
        return name[: m.start()].strip(" –-"), m.group(1).strip().capitalize()
    m = re.search(rf"\b{COLOR_WORDS}\b", name, re.I)
    if m:
        return (name[: m.start()] + name[m.end():]).replace("  ", " ").strip(" ,–-"), m.group(1).capitalize()
    return name.strip(), None


def sentences(text):
    t = re.sub(r"\s+", " ", (text or "")).strip()
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", t) if len(s.strip()) > 25]


def build_texts(p):
    d = p["data"]
    name = clean_name(p.get("name_pt") or d.get("name") or "", is_filament(p))
    base, color = split_color(name)
    brand = p.get("brand") or ""
    if brand and brand.lower() not in base.lower():
        base = f"{base} {brand}"
    cat = (p.get("category") or "").lower()
    if "3d printing" in cat and "impressora 3d" not in base.lower() and "impressão 3d" not in base.lower():
        base = f"{base} para Impressora 3D"
    title = title_case(re.sub(r"\s+", " ", base))[:200]

    desc = d.get("kairos_technical_description") or d.get("description_sale") or ""
    sents = sentences(desc)
    intro = " ".join(sents[:2]) if sents else f"{title}."
    bullets = []
    for s in sents[2:8]:
        s = s.rstrip(".")
        if 25 <= len(s) <= 200:
            bullets.append(s[0].upper() + s[1:])
        if len(bullets) == 5:
            break
    while len(bullets) < 3:
        extra = [f"Marca: {brand}" if brand else None,
                 f"Origem: {p.get('origin_country') or 'consultar'}",
                 f"Código do produto: {pcode(p)}"]
        for e in extra:
            if e and e not in bullets and len(bullets) < 3:
                bullets.append(e)

    consumable = any(k in cat for k in ("filament", "material", "consum"))
    warranty = ("30 dias contra defeitos de fabricação, conforme o Código de Defesa do Consumidor."
                if consumable else "90 dias contra defeitos de fabricação, conforme o Código de Defesa do Consumidor.")
    care = ("Guarde em local seco e fechado, de preferência com sílica gel e longe da luz solar direta. Depois de aberto, "
            "mantenha em embalagem vedada para evitar a absorção de umidade." if consumable else
            "Siga as instruções do fabricante. Guarde em local seco e arejado, longe da luz solar direta.")
    box = f"1 unidade de {base}" + (f", cor {color.lower()}." if color else ".")
    origin = p.get("origin_country") or "China"

    attrs = {"Marca": brand or "—", "Modelo / linha": base}
    if color:
        attrs["Cor"] = color
    for rx, label in ((r"(\d+[,.]?\d*)\s*mm", "Diâmetro / medida"), (r"(\d+[,.]?\d*)\s*kg", "Peso líquido")):
        m = re.search(rx, name, re.I)
        if m:
            attrs[label] = m.group(0)
    attrs["País de origem"] = origin
    if p.get("ncm"):
        attrs["NCM"] = p["ncm"]
    if d.get("kairos_package_qty"):
        attrs["Unidades por caixa master"] = str(int(d["kairos_package_qty"]))
    attrs["SKU"] = pcode(p)

    words = [w.lower() for w in re.findall(r"[A-Za-zÀ-ÿ0-9,]+", base) if len(w) > 2 and w.lower() not in STOP]
    kw = list(dict.fromkeys([" ".join(words[:3]), f"{(brand or '').lower()} {words[0] if words else ''}".strip(),
                             *[f"{w} {color.lower()}" for w in words[:1] if color], *words[:8]]))
    hashtags = list(dict.fromkeys(["#" + re.sub(r"[^a-z0-9]", "", w) for w in words[:6] if re.sub(r"[^a-z0-9]", "", w)]
                                  + ([f"#{re.sub(r'[^a-z0-9]', '', brand.lower())}"] if brand else []) + ["#achadinhos", "#tiktokshopbrasil"]))

    short = re.sub(r"\s+para Impressora 3D$", "", title)
    marketplaces = {
        "tiktok_shop": {"titulo": title, "bullets": bullets},
        "mercado_livre": {"titulo": (short + (f" {color}" if color else ""))[:60].rstrip(), "bullets": bullets},
        "shopee": {"titulo": (title + (f" {color}" if color else ""))[:120], "bullets": bullets},
        "amazon": {"titulo": f"{brand} {short}{(', ' + color) if color else ''}"[:200], "bullets": [b.upper()[:1] + b[1:] for b in bullets]},
        "alibaba": {"titulo": (p.get("name_en") or short)[:128], "bullets": sentences(d.get("kairos_technical_description_en") or "")[:5]},
    }
    hook = f"Procurando {words[0] if words else 'isso'} de qualidade? Olha esse {brand or 'aqui'}!"
    feed = {
        "caption": f"{title} 🔥 {bullets[0] if bullets else ''}. Toca no carrinho e garante o teu!",
        "hashtags": hashtags[:10], "searchKeywords": kw[:15],
        "hooks": [hook, f"{short}: vale a pena?", f"3 motivos pra escolher {brand or 'esse'} {words[0] if words else ''}"],
        "ctas": ["Toca no carrinho e garante o teu", "Clica no produto aqui embaixo do vídeo", "Comenta QUERO que eu te mando os detalhes"],
        "script": [], "creatorBrief": ["Mostre o produto real saindo da embalagem.", "Use só dados da ficha — nada de promessa extra.",
                                       "Termine com o CTA do carrinho."],
        "postingPlan": ["3 vídeos na semana com ganchos diferentes", "Repostar o gancho vencedor", "Ativar afiliados da categoria"],
        "videoFile": "",
    }
    listing = {
        "slug": pref(p), "sku": pcode(p), "odooId": p.get("odoo_id"), "brand": brand or "Sem marca",
        "brandAuthorizationConfirmed": False, "category": p.get("category") or "", "title": title,
        "variationStyle": "Cor" if color else "Modelo", "variations": [{"value": color or "Padrão", "sku": pcode(p), "stock": None}],
        "intro": intro, "bullets": bullets, "boxContents": box, "origin": origin, "warranty": warranty, "care": care,
        "attributes": attrs, "price": (p.get("list_price") if (p.get("list_price") or 0) > 1 else None),
        "costFobBrl": p.get("price_brl"), "costFobUsd": p.get("price_usd"),
        "packageDimensionsCm": None, "packageWeightKg": None, "images": [], "videos": [],
    }
    return listing, feed, marketplaces, color, base


# ----------------------------------------------------------------------------- imagens
def main_image(src_bytes, out_path, side=1600):
    im = Image.open(io.BytesIO(src_bytes)).convert("RGBA")
    bg = Image.new("RGBA", im.size, "white")
    bg.alpha_composite(im)
    rgb = bg.convert("RGB")
    import numpy as np
    a = np.asarray(rgb).astype(int)
    mask = a.min(axis=2) < 245
    if mask.any():
        ys, xs = np.where(mask)
        rgb = rgb.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    t = int(side * 0.85)
    r = t / max(rgb.size)
    rgb = rgb.resize((max(1, round(rgb.width * r)), max(1, round(rgb.height * r))), Image.LANCZOS)
    c = Image.new("RGB", (side, side), "white")
    c.paste(rgb, ((side - rgb.width) // 2, (side - rgb.height) // 2))
    c.save(out_path, quality=92)
    return min(Image.open(io.BytesIO(src_bytes)).size)


def higgsfield_available():
    return shutil.which("higgsfield") is not None or shutil.which("higgsfield.cmd") is not None


def higgs_image(prompt, ref_path, out_path):
    cmd = (["cmd", "/c"] if os.name == "nt" else []) + [
        "higgsfield", "generate", "create", "gpt_image_2_5", "--prompt", re.sub(r"\s+", " ", prompt),
        "--image-references", ref_path, "--quality", "high", "--resolution", "2k", "--aspect_ratio", "1:1",
        "--wait", "--wait-timeout", "15m", "--json"]
    out = subprocess.check_output(cmd, stderr=subprocess.STDOUT, timeout=1000).decode("utf-8", "replace")
    urls = re.findall(r"https://\S+?\.(?:png|jpg|jpeg|webp)", out)
    if not urls:
        raise RuntimeError("higgsfield sem URL: " + out[-200:])
    raw = urllib.request.urlopen(urls[0], context=CTX, timeout=180).read()
    Image.open(io.BytesIO(raw)).convert("RGB").resize((1200, 1200), Image.LANCZOS).save(out_path, quality=90)


SCENES = [
    ("02_uso.jpg", "uso", "Realistic e-commerce lifestyle photo of the exact product from the reference image (keep shape, colors, logo and label identical) being used in its natural real-world setting, natural light, premium, realistic. No text, no added graphics."),
    ("03_detalhe.jpg", "close-up", "Macro close-up product photo of the exact product from the reference image showing material texture and build quality, soft studio light, clean background. Keep it identical to the reference. No text, no added graphics."),
    ("04_escala.jpg", "escala", "Realistic photo of an adult hand holding or next to the exact product from the reference image to show its real size, neutral light gray background, soft light. Keep the product identical. No text, no added graphics."),
    # imagens comerciais / UGC (padrão da plataforma para qualquer empresa): pessoas usando e resultado
    ("05_ugc_pessoa.jpg", "pessoa usando", "Authentic UGC smartphone photo of a Brazilian adult happily using the exact product from the reference image in its typical real-life situation, natural light, slightly imperfect handheld framing, real home or work background. Keep the product (shape, colors, logo, label) identical. No text, no watermarks."),
    ("06_ugc_resultado.jpg", "resultado", "Realistic photo showing the result or benefit of using the exact product from the reference image (what it makes possible, the finished outcome), with a person's hands in frame, authentic customer-result style, natural light. Keep the product identical. No text."),
]


# ----------------------------------------------------------------------------- vídeo (slideshow comercial com locução)
def tts(text, out_mp3, edge_voice="pt-BR-AntonioNeural"):
    key = os.environ.get("ELEVENLABS_API_KEY")
    if key:
        voice = os.environ.get("ELEVENLABS_VOICE_ID") or "ybT9EL9NMy8gLjKo6TCr"
        req = urllib.request.Request(f"https://api.elevenlabs.io/v1/text-to-speech/{voice}",
                                     json.dumps({"text": text, "model_id": "eleven_multilingual_v2"}).encode(),
                                     {"xi-api-key": key, "Content-Type": "application/json"})
        open(out_mp3, "wb").write(urllib.request.urlopen(req, context=CTX, timeout=180).read())
        return "ElevenLabs"
    import asyncio
    if os.environ.get("SSL_CERT_FILE"):  # proxy corporativo: edge-tts usa o bundle do certifi
        import certifi
        certifi.where = lambda: os.environ["SSL_CERT_FILE"]
    import edge_tts
    asyncio.run(edge_tts.Communicate(text, edge_voice, rate="+8%").save(out_mp3))
    return "edge-tts"


def higgs_video(prompt, ref_path, out_path, duration=5):
    """Clipe de uso real (Kling 3.0 na Higgsfield) a partir da foto real do produto."""
    cmd = (["cmd", "/c"] if os.name == "nt" else []) + [
        "higgsfield", "generate", "create", os.environ.get("HIGGS_VIDEO_MODEL", "kling3_0"), "--prompt", re.sub(r"\s+", " ", prompt),
        "--image-references", ref_path, "--aspect_ratio", "9:16", "--duration", str(duration), "--mode", "std", "--sound", "off",
        "--wait", "--wait-timeout", "20m", "--json"]
    out = subprocess.check_output(cmd, stderr=subprocess.STDOUT, timeout=1500).decode("utf-8", "replace")
    urls = re.findall(r"https://\S+?\.mp4", out)
    if not urls:
        raise RuntimeError("higgsfield sem vídeo: " + out[-200:])
    open(out_path, "wb").write(urllib.request.urlopen(urls[0], context=CTX, timeout=300).read())
    return out_path


def slideshow(images, voice_mp3, out_mp4, workdir):
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", voice_mp3],
                               capture_output=True, text=True).stdout or 12) + 1.0
    per = dur / len(images)
    inputs, chains = [], []
    for i, img in enumerate(images):
        # cada foto num quadro 9:16 branco, com zoom lento
        frame = os.path.join(workdir, f"frame_{i}.jpg")
        im = Image.open(img).convert("RGB")
        c = Image.new("RGB", (1080, 1920), "white")
        im.thumbnail((1000, 1000))
        c.paste(im, ((1080 - im.width) // 2, (1920 - im.height) // 2))
        c.save(frame, quality=92)
        inputs += ["-framerate", "30", "-loop", "1", "-t", f"{per:.2f}", "-i", frame]
        chains.append(f"[{i}:v]zoompan=z='1.0+0.0010*on':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30,setsar=1,format=yuv420p[v{i}]")
    n = len(images)
    fc = ";".join(chains) + ";" + "".join(f"[v{i}]" for i in range(n)) + f"concat=n={n}:v=1:a=0,scale=720:1280[v];" + \
        f"[{n}:a]highpass=f=80,equalizer=f=3000:t=q:w=1.4:g=3,acompressor=threshold=-20dB:ratio=3,apad,atrim=0:{dur:.2f},loudnorm=I=-14:TP=-1[a]"
    subprocess.run(["ffmpeg", "-v", "error", "-y", *inputs, "-i", voice_mp3, "-filter_complex", fc, "-map", "[v]", "-map", "[a]",
                    "-t", f"{dur:.2f}", "-c:v", "libx264", "-crf", "28", "-preset", "slow",
                    "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", out_mp4], check=True)
    return dur


# ----------------------------------------------------------------------------- execução do job
class Job:
    def __init__(self, sb, row):
        self.sb, self.row, self.id = sb, row, row["id"]
        self.steps = row["steps"] or []

    def step(self, key, status, detail=None):
        for s in self.steps:
            if s["key"] == key:
                s["status"], s["at"] = status, datetime.now(timezone.utc).isoformat()
                if detail is not None:
                    s["detail"] = detail
        self.sb.patch("mk_ad_jobs", f"id=eq.{self.id}", {"steps": self.steps, "updated_at": datetime.now(timezone.utc).isoformat()})

    def canceled(self):
        r = self.sb.select("mk_ad_jobs", f"id=eq.{self.id}&select=status")
        return bool(r) and r[0]["status"] == "canceled"


def run_job(sb, row):
    sb.company = row.get("company_id")
    job = Job(sb, row)
    opts = row.get("options") or {}
    work = tempfile.mkdtemp(prefix=f"mkjob-{job.id[:8]}-")
    out = os.path.join(work, "tiktok")
    os.makedirs(out)
    avisos, custo, cur = [], {}, "dados"
    try:
        # 1 dados
        job.step("dados", "running")
        if row.get("draft_id"):
            p = product_from_draft(sb, row["draft_id"])
        else:
            prod = sb.select("mk_catalog_products", f"odoo_id=eq.{row['odoo_id']}&select=*")
            if not prod:
                raise RuntimeError(f"produto {row['odoo_id']} não está no catálogo sincronizado")
            p = prod[0]
        job.step("dados", "done", f"{p['name_pt']} · {p.get('brand') or 'sem marca'} · cadastro {p['completeness']}%")

        # 2 lacunas
        cur = "lacunas"
        miss = p.get("missing") or []
        avisos += [f"Cadastro: falta {m}" for m in miss]
        job.step("lacunas", "done", ("Faltando: " + ", ".join(miss)) if miss else "Cadastro completo")
        if job.canceled():
            return

        # 3 foto principal
        cur = "foto"
        job.step("foto", "running")
        images, meta_extra = [], {}
        photo = None
        if p.get("photo_paths"):
            photo = sb.download("mk-fontes", p["photo_paths"][0])
        elif p.get("has_image"):
            pid = p.get("odoo_id") or p.get("odoo_photo_id")
            photo = urllib.request.urlopen(f"{sb.base}/storage/v1/object/public/assets/catalogo/{pid}.jpg", context=CTX, timeout=60).read()
        if photo:
            src_side = main_image(photo, os.path.join(out, "01_principal.jpg"))
            images.append({"file": "01_principal.jpg", "role": "principal", "alt": f"{p['name_pt']} — foto do produto em fundo branco",
                           "hasAddedText": False, "aiGenerated": False, "angle": "frontal"})
            note = f"Foto {'do cadastro' if p.get('photo_paths') else 'do Odoo'} ({src_side}px de origem) em fundo branco 1600×1600"
            if src_side < 1000:
                avisos.append(f"Foto do Odoo tem só {src_side}px — para zoom no marketplace, suba uma foto maior (ideal ≥ 1600px)")
                note += " · origem pequena"
            job.step("foto", "done", note)
        else:
            avisos.append("Produto sem foto no Odoo: sem imagem principal o anúncio não passa na política")
            job.step("foto", "error", "Sem foto do produto — envie fotos no cadastro (ou cadastre no Odoo)")

        # 4 cenas IA
        cur = "cenas"
        if not opts.get("cenas_ia"):
            job.step("cenas", "skipped", "Não solicitado")
        elif not photo:
            job.step("cenas", "skipped", "Sem foto de referência do produto")
        elif not higgsfield_available():
            job.step("cenas", "skipped", "CLI da Higgsfield não está instalada/logada nesta máquina")
            avisos.append("Cenas de IA puladas: instale e faça login na CLI da Higgsfield no worker")
        else:
            job.step("cenas", "running", f"Gerando {len(SCENES)} cenas (uso, detalhe, escala, pessoa usando e resultado)…")
            ok = 0
            for fname, angle, prompt in SCENES:
                try:
                    higgs_image(prompt, os.path.join(out, "01_principal.jpg"), os.path.join(out, fname))
                    images.append({"file": fname, "role": "galeria", "alt": f"{p['name_pt']} — {angle}",
                                   "hasAddedText": False, "aiGenerated": True, "angle": angle})
                    ok += 1
                except Exception as e:
                    avisos.append(f"Cena '{angle}' falhou: {str(e)[:120]}")
            custo["Higgsfield (créditos)"] = round(ok * HIGGS_IMG_CREDITS, 2)
            job.step("cenas", "done" if ok else "error", f"{ok}/{len(SCENES)} cenas geradas · ~{ok * HIGGS_IMG_CREDITS:.2f} créditos")
            if ok:
                avisos.append("Cenas de IA: confira se cor, rótulo e formato batem com o produto real antes de publicar")
        if job.canceled():
            return

        # 5 textos
        cur = "textos"
        job.step("textos", "running")
        listing, feed, mk_texts, color, base = build_texts(p)
        job.step("textos", "done", f"Título ({len(listing['title'])} car.): {listing['title']}\n{len(listing['bullets'])} tópicos · "
                                   f"{len(feed['searchKeywords'])} palavras-chave · {len(row['marketplaces'])} marketplaces")

        # 6 dúvidas (FAQ)
        cur = "duvidas"
        job.step("duvidas", "running")
        import build_faq_cards as faq
        ref = os.path.join(out, "01_principal.jpg")
        footer = f"{p.get('brand') or ''} • SKU {listing['sku']}".strip(" •")
        if os.path.exists(ref):
            faq.card(1, "O que vem na embalagem?", listing["boxContents"].rstrip("."), [listing["boxContents"].rstrip("."),
                     f"País de origem: {listing['origin']}", f"Garantia: {listing['warranty'].split(',')[0]}"],
                     ref, 560, "faq1_embalagem.jpg", footer=footer, out_dir=out)
            faq.card(2, "Principais características", listing["title"][:60], listing["bullets"][:3], ref, 520,
                     "faq2_caracteristicas.jpg", footer=footer, out_dir=out)
            for f_, a in (("faq1_embalagem.jpg", "Dúvida: o que vem na embalagem"), ("faq2_caracteristicas.jpg", "Principais características")):
                images.append({"file": f_, "role": "descricao", "alt": a, "hasAddedText": True, "aiGenerated": False, "angle": "faq-" + f_})
            job.step("duvidas", "done", "2 imagens de dúvidas (vão na descrição — a galeria não aceita texto)")
        else:
            job.step("duvidas", "skipped", "Sem foto do produto para compor as imagens")

        # 7 vídeo
        cur = "video"
        if not opts.get("video"):
            job.step("video", "skipped", "Não solicitado")
        elif not os.path.exists(ref):
            job.step("video", "skipped", "Sem imagens do produto")
        else:
            use_ai = bool(opts.get("cenas_ia")) and higgsfield_available()
            job.step("video", "running", "Roteiro + locução por trecho + cenas " + ("de IA (Higgsfield)" if use_ai else "das imagens geradas") + "…")
            import commercial
            scenes = [{"path": os.path.join(out, i["file"]), "angle": i.get("angle", "")} for i in images
                      if i["role"] != "descricao" and i["file"] != "01_principal.jpg"]
            seed = row["id"]
            voices = ["pt-BR-AntonioNeural", "pt-BR-FranciscaNeural", "pt-BR-ThalitaMultilingualNeural"]
            edge_voice = voices[int(row["id"][:8], 16) % len(voices)]
            res = commercial.build(p, listing, feed, ref, scenes, os.path.join(work, "comercial"),
                                   os.path.join(out, "video_feed_9x16.mp4"), os.path.join(out, "video_produto.mp4"),
                                   lambda t, o: tts(t, o, edge_voice), higgs_video if use_ai else None, seed=seed)
            if res["cenas_ia"]:
                custo["Higgsfield vídeo (clipes)"] = res["cenas_ia"]
            if os.path.getsize(os.path.join(out, "video_produto.mp4")) <= VIDEO_MAX:
                listing["videos"].append({"file": "video_produto.mp4", "role": "produto"})
            feed["videoFile"] = "video_feed_9x16.mp4"
            feed["script"] = [{"t": f"{k + 1}", "visual": r["t"], "fala": r["fala"], "legenda": ""} for k, r in enumerate(res["roteiro"])]
            feed["voice"] = {"provider": res["voz"], "voz": edge_voice if res["voz"] == "edge-tts" else "ElevenLabs", "modelo": "", "texto": " ".join(r["fala"] for r in res["roteiro"])}
            job.step("video", "done", f"{res['duracao']:.1f}s · {len(res['roteiro'])} cenas ({res['cenas_ia']} de IA) · roteiro {res['roteirista']} · voz {res['voz']} · "
                     f"{os.path.getsize(os.path.join(out, 'video_produto.mp4')) / 1e6:.2f} MB")

        # 8 validação (rápida aqui; a completa roda no portal com lib/marketplace/tiktok.ts)
        cur = "validacao"
        listing["images"] = images
        from build_tiktok_assets import measure_image, probe
        meta = {i["file"]: measure_image(os.path.join(out, i["file"])) for i in images}
        for v in listing["videos"]:
            meta[v["file"]] = probe(os.path.join(out, v["file"]))
        quick = []
        if not 25 <= len(listing["title"]) <= 200:
            quick.append("título fora de 25–200 caracteres")
        if not any(i["role"] == "principal" for i in images):
            quick.append("sem imagem principal")
        gal_n = len([i for i in images if i["role"] != "descricao"])
        if gal_n < 5:
            avisos.append(f"Galeria com {gal_n} imagens (o TikTok recomenda pelo menos 5)")
        job.step("validacao", "error" if quick else "done",
                 ("Bloqueios: " + "; ".join(quick)) if quick else "Checagem rápida ok — checklist completo da política no anúncio")

        # 9 pacote
        cur = "pacote"
        job.step("pacote", "running", "Enviando arquivos…")
        prefix = f"mk/{job.id}/tiktok"
        for f_ in os.listdir(out):
            ctype = "video/mp4" if f_.endswith(".mp4") else "image/jpeg"
            sb.upload("renders", f"{prefix}/{f_}", open(os.path.join(out, f_), "rb").read(), ctype)
        base_url = f"{sb.base}/storage/v1/object/public/renders/{prefix}"
        bundle = {"listing": listing, "feed": feed, "meta": meta, "baseUrl": base_url}
        zbuf = io.BytesIO()
        with zipfile.ZipFile(zbuf, "w", zipfile.ZIP_DEFLATED) as z:
            for f_ in sorted(os.listdir(out)):
                z.write(os.path.join(out, f_), f"tiktok/{f_}")
            z.writestr("anuncio.json", json.dumps(bundle, ensure_ascii=False, indent=2))
            z.writestr("textos_por_marketplace.json", json.dumps(mk_texts, ensure_ascii=False, indent=2))
            z.writestr("avisos.txt", "\n".join(avisos) or "sem avisos")
        zip_url = sb.upload("renders", f"mk/{job.id}/pacote_{listing['slug']}.zip", zbuf.getvalue(), "application/zip")
        selected = {k: v for k, v in mk_texts.items() if k in row["marketplaces"]}
        resumo = (f"{len([i for i in images if i['role'] != 'descricao'])} imagens de galeria, "
                  f"{len([i for i in images if i['role'] == 'descricao'])} de dúvidas, "
                  f"{'1 vídeo' if listing['videos'] else 'sem vídeo'}; textos para {', '.join(selected)}.")
        if job.canceled():
            raise JobCanceled()
        sb.patch("mk_ad_jobs", f"id=eq.{job.id}&status=eq.running", {
            "status": "done", "credits_used": sum(custo.values()) if custo else 0,
            "result": {"bundle": bundle, "zipUrl": zip_url, "marketplaces": selected, "avisos": avisos, "custo": custo, "resumo": resumo},
            "updated_at": datetime.now(timezone.utc).isoformat()})
        job.step("pacote", "done", "Pacote ZIP + anúncio publicados no portal")
        sb.audit("agente.job_concluido", "job", job.id, f"Agente concluiu o anúncio de {pref(p)} ({resumo})",
                 {"avisos": len(avisos), "custo": custo, "zip": zip_url})
    except JobCanceled:
        _safe(lambda: job.step(cur, "error", "cancelado pelo usuário"))
        _safe(lambda: sb.audit("agente.job_cancelado_worker", "job", job.id, f"Worker parou o job na etapa {cur} (cancelado)"))
    except BaseException as e:  # inclui KeyboardInterrupt: o job nunca fica preso em "running"
        traceback.print_exc()
        _safe(lambda: job.step(cur, "error", str(e)[:400]))
        _mark_error(sb, job.id, str(e) or e.__class__.__name__, avisos)
        _safe(lambda: sb.audit("agente.job_erro", "job", job.id, f"Agente falhou na etapa {cur}: {str(e)[:160]}"))
        if not isinstance(e, Exception):
            raise
    finally:
        shutil.rmtree(work, ignore_errors=True)


class JobCanceled(Exception):
    pass


def _safe(fn):
    try:
        fn()
    except Exception as e:
        print("[agente] aviso:", e)


def _mark_error(sb, job_id, msg, avisos):
    """Marca erro só se o job ainda estiver em execução (não sobrescreve um cancelamento). Tenta 3 vezes."""
    for k in range(3):
        try:
            sb.patch("mk_ad_jobs", f"id=eq.{job_id}&status=eq.running",
                     {"status": "error", "result": {"erro": msg[:400], "avisos": avisos},
                      "updated_at": datetime.now(timezone.utc).isoformat()})
            return
        except Exception as e:
            print("[agente] falha ao marcar erro:", e)
            time.sleep(2 * (k + 1))


AD_STEPS = [{"key": k, "label": l, "status": "pending"} for k, l in [
    ("dados", "Ler cadastro completo"), ("lacunas", "Checar lacunas do cadastro"), ("foto", "Foto principal (fundo branco 1:1)"),
    ("cenas", "Cenas de uso (IA, sem texto)"), ("textos", "Título, descrição, atributos, palavras-chave"),
    ("duvidas", "Imagens de dúvidas (FAQ)"), ("video", "Vídeo comercial (opcional)"), ("validacao", "Validar política de cada marketplace"),
    ("pacote", "Pacote final (ZIP + JSON/CSV)")]]


def run_ingest_job(sb, row):
    job = Job(sb, row)
    try:
        res = run_ingest(sb, row, job, CTX, AD_STEPS)
        if res is None:
            return
        sb.patch("mk_ad_jobs", f"id=eq.{job.id}&status=eq.running", {"status": "done", "result": res, "updated_at": datetime.now(timezone.utc).isoformat()})
        sb.audit("agente.ingestao_concluida", "job", job.id, res["resumo"], {"draft_id": res["draft_id"], "ad_job_id": res["ad_job_id"]}, company=row["company_id"])
    except BaseException as e:
        traceback.print_exc()
        _mark_error(sb, job.id, str(e) or e.__class__.__name__, [])
        _safe(lambda: sb.audit("agente.ingestao_erro", "job", job.id, f"Leitura dos materiais falhou: {str(e)[:160]}", company=row["company_id"]))
        if not isinstance(e, Exception):
            raise


def claim(sb, job_id=None):
    q = f"id=eq.{job_id}" if job_id else "status=eq.queued&order=created_at.asc&limit=1"
    rows = sb.select("mk_ad_jobs", q + "&select=*")
    for r in rows or []:
        if job_id is None and r["status"] != "queued":
            continue
        got = sb.patch("mk_ad_jobs", f"id=eq.{r['id']}&status=in.(queued,error)", {"status": "running",
                       "updated_at": datetime.now(timezone.utc).isoformat()}, ret=True)
        if got:
            return got[0]
    return None


def main():
    load_env()
    sb = Supa()
    once = "--once" in sys.argv
    jid = sys.argv[sys.argv.index("--job") + 1] if "--job" in sys.argv else None
    print(f"[agente] conectado como {sb.user_email}; higgsfield={'sim' if higgsfield_available() else 'não'}; "
          f"elevenlabs={'sim' if os.environ.get('ELEVENLABS_API_KEY') else 'não'}")
    fails = 0
    while True:
        try:
            row = claim(sb, jid)
            fails = 0
        except Exception as e:  # rede/Supabase instável: espera e tenta de novo, sem derrubar o agente
            fails += 1
            wait = min(300, 5 * 2 ** min(fails, 6))
            print(f"[agente] falha ao consultar a fila ({str(e)[:120]}); nova tentativa em {wait}s")
            time.sleep(wait)
            continue
        if row:
            print(f"[agente] job {row['id']} ({row.get('kind', 'anuncio')} · {row.get('odoo_id') or row.get('draft_id') or 'materiais'})")
            if row.get("kind") == "ingestao":
                run_ingest_job(sb, row)
            else:
                run_job(sb, row)
            if jid:
                return
            continue
        if once or jid:
            return
        time.sleep(int(os.environ.get("POLL_INTERVAL_MS", "5000")) / 1000)


if __name__ == "__main__":
    main()
