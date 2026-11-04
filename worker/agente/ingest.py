"""Ingestão de materiais da empresa (links, fotos, PDFs) -> cadastro padrão (mk_product_drafts) -> anúncios.

Funciona sem IA (extrai de JSON-LD/Open Graph/HTML e do texto do PDF). Com ANTHROPIC_API_KEY no .env do worker,
usa o Claude para ler tudo e preencher os campos do cadastro (mesmos nomes técnicos do "cotar" do Odoo).
Nada é inventado: campo que não aparece nos materiais fica vazio e vira "lacuna" no cadastro.
"""
import base64
import html
import io
import json
import os
import re
import subprocess
import tempfile
import urllib.parse
import urllib.request
from datetime import datetime, timezone

from PIL import Image

UA = "Mozilla/5.0 (compatible; KairosAdsAgent/1.0; +https://fortunacreative.com.br)"
COTAR_KEYS = [
    "default_code", "kairos_name_pt", "kairos_name_en", "kairos_brand", "categ_id", "barcode", "kairos_price", "kairos_price_currency_code",
    "kairos_price_usd", "kairos_price_brl", "list_price", "kairos_ncm_id", "kairos_hs_id", "kairos_origin_country_id",
    "kairos_technical_name", "kairos_technical_description", "kairos_technical_description_en", "description_sale", "kairos_voltage",
    "kairos_fixed_weight", "kairos_gross_weight", "kairos_package_qty", "kairos_package_length", "kairos_package_width",
    "kairos_package_height", "kairos_package_gross_weight", "kairos_missing_cert_names",
]
REQUIRED = {"kairos_name_pt": "Nome comercial (PT)", "kairos_brand": "Marca", "barcode": "Código de barras (EAN/GTIN)",
            "kairos_price_brl": "Custo (BRL)", "list_price": "Preço de venda (BRL)", "kairos_ncm_id": "NCM",
            "kairos_origin_country_id": "País de origem", "kairos_technical_description": "Descrição técnica (PT)",
            "kairos_fixed_weight": "Peso líquido", "kairos_package_length": "Comprimento da caixa",
            "kairos_package_width": "Largura da caixa", "kairos_package_height": "Altura da caixa",
            "kairos_package_gross_weight": "Peso bruto da caixa"}


def now():
    return datetime.now(timezone.utc).isoformat()


def http_get(url, ctx, limit=15 * 1024 * 1024, headers=None):
    req = urllib.request.Request(url, headers={"User-Agent": UA, **(headers or {})})
    with urllib.request.urlopen(req, context=ctx, timeout=60) as r:
        return r.read(limit), r.headers.get("Content-Type", "")


# ----------------------------------------------------------------------------- leitura
def parse_html(raw, base):
    t = raw.decode("utf-8", "ignore")
    meta = {}
    for m in re.finditer(r'<meta[^>]+(?:property|name)=["\']([^"\']+)["\'][^>]+content=["\']([^"\']*)["\']', t, re.I):
        meta.setdefault(m.group(1).lower(), html.unescape(m.group(2)))
    title = html.unescape((re.search(r"<title[^>]*>(.*?)</title>", t, re.I | re.S) or [None, ""])[1]).strip()
    ld = []
    for m in re.finditer(r'<script[^>]+application/ld\+json[^>]*>(.*?)</script>', t, re.I | re.S):
        try:
            j = json.loads(m.group(1).strip())
        except Exception:
            continue
        for x in (j if isinstance(j, list) else j.get("@graph", [j]) if isinstance(j, dict) else []):
            if isinstance(x, dict) and "Product" in str(x.get("@type")):
                ld.append(x)
    imgs = []
    for k in ("og:image", "og:image:url", "twitter:image"):
        if meta.get(k):
            imgs.append(urllib.parse.urljoin(base, meta[k]))
    for p in ld:
        im = p.get("image")
        for u in (im if isinstance(im, list) else [im]):
            u = u.get("url") if isinstance(u, dict) else u
            if isinstance(u, str):
                imgs.append(urllib.parse.urljoin(base, u))
    body = re.sub(r"<(script|style|noscript)[^>]*>.*?</\1>", " ", t, flags=re.S | re.I)
    text = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", body))).strip()
    return {"title": meta.get("og:title") or title, "description": meta.get("og:description") or meta.get("description") or "",
            "ld": ld[:3], "images": list(dict.fromkeys(imgs))[:8], "text": text[:20000], "site": meta.get("og:site_name") or ""}


def pdf_text(data):
    with tempfile.TemporaryDirectory() as d:
        p = os.path.join(d, "f.pdf")
        open(p, "wb").write(data)
        out = subprocess.run(["pdftotext", "-layout", "-l", "20", p, "-"], capture_output=True, timeout=120)
        txt = out.stdout.decode("utf-8", "ignore")
        cover = None
        r = subprocess.run(["pdftoppm", "-r", "110", "-f", "1", "-l", "1", "-jpeg", p, os.path.join(d, "pg")], capture_output=True, timeout=120)
        pgs = [f for f in os.listdir(d) if f.startswith("pg")]
        if r.returncode == 0 and pgs:
            cover = open(os.path.join(d, pgs[0]), "rb").read()
    return re.sub(r"[ \t]{2,}", "  ", txt)[:30000], cover


def to_jpeg(data, side=1600):
    im = Image.open(io.BytesIO(data))
    im = im.convert("RGBA")
    bg = Image.new("RGBA", im.size, "white")
    bg.alpha_composite(im)
    rgb = bg.convert("RGB")
    rgb.thumbnail((side, side), Image.LANCZOS)
    b = io.BytesIO()
    rgb.save(b, "JPEG", quality=90)
    return b.getvalue(), rgb.size


# ----------------------------------------------------------------------------- extração
def heuristics(pages, pdfs, note):
    d = {}
    for pg in pages:
        for p in pg["ld"]:
            d.setdefault("kairos_name_pt", p.get("name"))
            b = p.get("brand")
            d.setdefault("kairos_brand", b.get("name") if isinstance(b, dict) else b)
            d.setdefault("kairos_technical_description", re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", str(p.get("description") or "")))).strip() or None)
            d.setdefault("default_code", p.get("sku") or p.get("mpn"))
            d.setdefault("barcode", p.get("gtin13") or p.get("gtin") or p.get("gtin12") or p.get("gtin8"))
            off = p.get("offers")
            off = off[0] if isinstance(off, list) and off else off
            if isinstance(off, dict) and off.get("price") and str(off.get("priceCurrency", "BRL")).upper() == "BRL":
                d.setdefault("kairos_reference_price", float(str(off["price"]).replace(",", ".")))
        d.setdefault("kairos_name_pt", pg["title"] or None)
        d.setdefault("kairos_technical_description", pg["description"] or None)
    if pdfs and not d.get("kairos_technical_description"):
        d["kairos_technical_description"] = pdfs[0][:1500]
    if pdfs and not d.get("kairos_name_pt"):
        first = next((ln.strip() for ln in pdfs[0].splitlines() if len(ln.strip()) > 8), None)
        d["kairos_name_pt"] = first[:200] if first else None
    if note and not d.get("kairos_name_pt"):
        d["kairos_name_pt"] = note[:200]
    return {k: v for k, v in d.items() if v not in (None, "")}


def claude_extract(pages, pdfs, photos, note, instr):
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        return None
    parts = []
    for pg in pages:
        parts.append(f"## Página {pg['url']}\nTítulo: {pg['title']}\nDescrição: {pg['description']}\nJSON-LD: {json.dumps(pg['ld'], ensure_ascii=False)[:6000]}\nTexto: {pg['text'][:8000]}")
    for i, t in enumerate(pdfs):
        parts.append(f"## PDF {i + 1}\n{t[:12000]}")
    content = [{"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": base64.b64encode(p).decode()}} for p in photos[:4]]
    content.append({"type": "text", "text": (
        "Você monta o cadastro de UM produto para venda em marketplaces brasileiros a partir dos materiais abaixo.\n"
        "Responda SOMENTE um JSON com estas chaves (use null quando o dado não estiver nos materiais; NÃO invente; números sem unidade; "
        "medidas em cm e kg; textos em português do Brasil): " + ", ".join(COTAR_KEYS) + ".\n"
        "kairos_technical_description: 3 a 6 frases objetivas só com o que está nos materiais. "
        "kairos_origin_country_id: nome do país. kairos_ncm_id: só se aparecer explicitamente.\n"
        f"Observação do cliente: {note or '-'}\nInstruções: {instr or '-'}\n\n" + "\n\n".join(parts))[:120000]})
    body = {"model": os.environ.get("AGENT_MODEL", "claude-sonnet-5-5"), "max_tokens": 2000, "messages": [{"role": "user", "content": content}]}
    req = urllib.request.Request("https://api.anthropic.com/v1/messages", json.dumps(body).encode(),
                                 {"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"})
    import ssl
    ctx = ssl.create_default_context(cafile=os.environ.get("SSL_CERT_FILE") or None)
    with urllib.request.urlopen(req, context=ctx, timeout=180) as r:
        out = json.loads(r.read())
    txt = "".join(c.get("text", "") for c in out.get("content", []))
    m = re.search(r"\{.*\}", txt, re.S)
    if not m:
        return None
    j = json.loads(m.group(0))
    return {k: v for k, v in j.items() if k in COTAR_KEYS and v not in (None, "", [])}


def completeness(d):
    miss = []
    for k, label in REQUIRED.items():
        v = d.get(k)
        if v in (None, ""):
            miss.append(label)
        elif k == "kairos_technical_description" and len(str(v)) < 120:
            miss.append(label)
        elif k == "barcode" and not re.fullmatch(r"\d{8}|\d{12,14}", str(v)):
            miss.append(label)
    return round((len(REQUIRED) - len(miss)) / len(REQUIRED) * 100), miss


# ----------------------------------------------------------------------------- job
def run_ingest(sb, row, job, ctx, ad_steps):
    company = row["company_id"]
    opts = row.get("options") or {}
    ids = row.get("source_ids") or []
    cur = "ler"
    job.step("ler", "running")
    srcs = sb.select("mk_company_sources", f"id=in.({','.join(ids)})&company_id=eq.{company}&select=*") if ids else []
    if not srcs:
        raise RuntimeError("nenhum material encontrado para esta empresa")
    for s in srcs:
        sb.patch("mk_company_sources", f"id=eq.{s['id']}", {"status": "processando"})
    pages, pdfs, photos, avisos = [], [], [], []
    notes = " ".join(s["note"] for s in srcs if s.get("note"))
    for s in srcs:
        try:
            if s["kind"] == "link":
                raw, ctype = http_get(s["url"], ctx)
                if "pdf" in ctype:
                    t, cover = pdf_text(raw)
                    pdfs.append(t)
                    if cover:
                        photos.append(cover)
                else:
                    pg = parse_html(raw, s["url"])
                    pg["url"] = s["url"]
                    pages.append(pg)
                    for u in pg["images"][:4]:
                        try:
                            b, _ = http_get(u, ctx, limit=8 * 1024 * 1024)
                            photos.append(b)
                        except Exception as e:
                            avisos.append(f"Imagem do link não baixou: {str(e)[:80]}")
            else:
                data = sb.download("mk-fontes", s["storage_path"])
                if s["kind"] == "pdf":
                    t, cover = pdf_text(data)
                    pdfs.append(t)
                    if cover and not any(x["kind"] == "foto" for x in srcs):
                        photos.append(cover)
                elif s["kind"] == "foto":
                    photos.insert(0, data)  # foto enviada pela empresa tem prioridade sobre a do site
        except Exception as e:
            avisos.append(f"{s.get('url') or s.get('file_name')}: não foi possível ler ({str(e)[:120]})")
            sb.patch("mk_company_sources", f"id=eq.{s['id']}", {"status": "erro", "result": {"erro": str(e)[:300]}})
    job.step("ler", "done", f"{len(pages)} página(s), {len(pdfs)} PDF(s), {len(photos)} imagem(ns)")
    if job.canceled():
        return None

    cur = "extrair"
    job.step("extrair", "running")
    d = heuristics(pages, pdfs, notes)
    via = "leitura direta (JSON-LD, Open Graph e texto)"
    try:
        ai = claude_extract(pages, pdfs, [to_jpeg(p, 800)[0] for p in photos[:4] if p], notes, opts.get("instrucoes"))
        if ai:
            d.update(ai)
            via = "Claude lendo páginas, PDFs e fotos"
    except Exception as e:
        avisos.append(f"Extração com IA falhou, usei a leitura direta: {str(e)[:120]}")
    if not d.get("kairos_name_pt"):
        raise RuntimeError("não encontrei o nome do produto nos materiais — envie o link da página do produto ou uma ficha em PDF")
    job.step("extrair", "done", f"{len(d)} campos encontrados · {via}")

    cur = "fotos"
    job.step("fotos", "running")
    fotos = []
    for i, p in enumerate(photos[:8]):
        try:
            jpg, size = to_jpeg(p)
            if min(size) < 300:
                continue
            path = f"{company}/gerado-{row['id'][:8]}-{i + 1}.jpg"
            sb.upload("mk-fontes", path, jpg, "image/jpeg")
            fotos.append(path)
        except Exception as e:
            avisos.append(f"Foto {i + 1} ignorada: {str(e)[:80]}")
    job.step("fotos", "done" if fotos else "error", f"{len(fotos)} foto(s) separadas" if fotos else "Nenhuma foto utilizável — envie fotos do produto")

    cur = "cadastro"
    job.step("cadastro", "running")
    pct, miss = completeness(d)
    d["fotos"] = fotos
    rows = sb.insert_ret("mk_product_drafts", {
        "company_id": company, "created_by": sb.user_id, "status": "rascunho", "name_pt": str(d["kairos_name_pt"])[:300],
        "sku": d.get("default_code"), "data": d, "completeness": pct, "updated_at": now()})
    draft = rows[0]
    for s in srcs:
        sb.patch("mk_company_sources", f"id=eq.{s['id']}&status=eq.processando", {"status": "processado", "result": {"draft_id": draft["id"]}})
    job.step("cadastro", "done", f"Cadastro {pct}% completo" + (f" · falta: {', '.join(miss)}" if miss else ""))

    ad_job = None
    if opts.get("gerar_anuncios") and fotos:
        ins = sb.insert_ret("mk_ad_jobs", {"company_id": company, "kind": "anuncio", "draft_id": draft["id"], "marketplaces": row["marketplaces"],
                                           "options": {"video": bool(opts.get("video")), "cenas_ia": False}, "steps": ad_steps, "created_by": sb.user_id})
        ad_job = ins[0]["id"]
        job.step("anuncios", "done", "Job de anúncios criado na fila")
    else:
        job.step("anuncios", "skipped", "Não solicitado" if not opts.get("gerar_anuncios") else "Sem fotos: revise o cadastro e gere os anúncios")
    return {"draft_id": draft["id"], "ad_job_id": ad_job, "avisos": avisos, "completude": pct, "faltando": miss,
            "resumo": f"Cadastro '{d['kairos_name_pt']}' montado ({pct}%), {len(fotos)} foto(s)" + (" · anúncios na fila" if ad_job else "")}


def product_from_draft(sb, draft_id):
    """Converte o rascunho no mesmo formato do espelho do Odoo usado pelo gerador de anúncios."""
    r = sb.select("mk_product_drafts", f"id=eq.{draft_id}&select=*")
    if not r:
        raise RuntimeError("cadastro não encontrado")
    x = r[0]
    d = x.get("data") or {}
    pct, miss = completeness(d)
    num = lambda k: (float(d[k]) if isinstance(d.get(k), (int, float)) else None)
    odoo_img = None
    if not d.get("fotos") and x.get("source_odoo_id"):
        c = sb.select("mk_catalog_products", f"odoo_id=eq.{x['source_odoo_id']}&select=has_image")
        if c and c[0].get("has_image"):
            odoo_img = x["source_odoo_id"]
    return {
        "odoo_id": None, "ref": f"prod-{x['id'][:8]}", "odoo_photo_id": odoo_img, "company_id": x["company_id"], "sku": x.get("sku") or d.get("default_code"),
        "name_pt": x["name_pt"], "name_en": d.get("kairos_name_en"), "brand": d.get("kairos_brand"), "category": d.get("categ_id"),
        "list_price": num("list_price"), "price_brl": num("kairos_price_brl"), "price_usd": num("kairos_price_usd"),
        "origin_country": d.get("kairos_origin_country_id"), "ncm": d.get("kairos_ncm_id"), "completeness": pct, "missing": miss,
        "has_image": bool(d.get("fotos")) or bool(odoo_img), "photo_paths": d.get("fotos") or [], "data": {**d, "name": x["name_pt"]},
    }
