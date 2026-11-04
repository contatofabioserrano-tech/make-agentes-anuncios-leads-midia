"""Comercial padrão "uso real" (o mesmo formato do comercial do Hyper PETG), para qualquer produto.

Estrutura (~16–20 s, 9:16):
  1 gancho     cena de uso em movimento      legenda grande, palavra-chave em amarelo
  2 produto    pessoa com o produto / unboxing
  3 benefício  detalhe / close-up
  4 resultado  resultado / produto em uso
  5 embalagem  foto real em fundo branco
  6 CTA        cartão final escuro: marca, nome, chips de especificação, produto recortado, brilho
Locução gravada por trecho (legenda casa exata com a fala), trilha com ducking, whoosh nos cortes, -14 LUFS.

Cenas: vídeo de IA (Higgsfield, se a CLI estiver logada) a partir da foto real; senão, as cenas/UGC geradas
com movimento de câmera; senão, recortes da foto principal com movimento. O formato nunca muda.
"""
import hashlib
import json
import os
import random
import re
import ssl
import urllib.request
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
FONTS = os.path.join(ROOT, "worker", "pipeline_py", "fonts")
MUSIC = os.path.join(ROOT, "worker", "assets", "music", "trilha_padrao.mp3")
W, H, FPS = 1080, 1920, 30
YEL = "{\\c&H00D4FF&}"

# cena de IA por trecho do roteiro (prompt usa a foto real como referência)
CLIP_PROMPTS = {
    "gancho": "Dynamic close-up video of the exact product from the reference image being used in its main real-world function, fast and satisfying motion, cinematic lighting, vertical 9:16. Keep the product identical. No text.",
    "produto": "Handheld UGC video: a person's hands take the exact product from the reference image out of its packaging and start using it, natural light, home setting, vertical 9:16. Keep the product identical. No text.",
    "beneficio": "Macro video close-up showing the build quality and key feature of the exact product from the reference image, slow camera slide, soft studio light, vertical 9:16. Keep the product identical. No text.",
    "resultado": "Video of the result of using the exact product from the reference image: the finished outcome being picked up and shown working in real life, natural light, vertical 9:16. Keep the product identical. No text.",
}
# imagem de apoio por trecho (ângulos das cenas/UGC geradas)
ANGLE_PREF = {
    "gancho": ["uso", "pessoa usando"], "produto": ["pessoa usando", "escala", "uso"],
    "beneficio": ["close-up", "detalhe", "lateral"], "resultado": ["resultado", "uso", "escala"],
}


def font(name, size):
    return ImageFont.truetype(os.path.join(FONTS, name), size)


def probe_dur(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                         capture_output=True, text=True).stdout.strip()
    return float(out or 0)


# ----------------------------------------------------------------------------- roteiro
def _clean(s):
    return re.sub(r"\s+", " ", s or "").strip(" .;:")


STOP_END = {"por", "de", "do", "da", "a", "o", "e", "em", "com", "para", "no", "na", "ao", "que", "mais", "ou"}


def _claim(bullet):
    """'Velocidade: imprime de 30 a 600 milímetros por segundo em ...' -> frase curta e completa (sem cortar no meio)."""
    b = _clean(bullet.split(":", 1)[1] if ":" in bullet else bullet)
    b = re.sub(r"\bmilímetros? por segundo\b", "mm/s", b)
    b = re.sub(r"\bgraus Celsius\b", "°C", b)
    b = re.sub(r"(\d+(?:,\d+)?) milímetros?\b", r"\1 mm", b)
    b = re.sub(r"\bquilogramas?\b", "kg", b)
    for sep in [r",(?!\d)", r";", r"\se\s", r"\spara\s", r"\sem\s"]:
        if len(b.split()) > 6 and re.search(sep, b):
            b = re.split(sep, b)[0]
    words = b.split()[:8]
    while words and words[-1].lower().strip(",.") in STOP_END:
        words.pop()
    t = " ".join(words).strip(" ,.;")
    return t[:1].upper() + t[1:] if t else ""


CTAS = ["Toca no carrinho e garante o teu!", "Clica no carrinho e leva o teu hoje!", "Garante o teu: toca no carrinho!",
        "Corre no carrinho antes que acabe o estoque!"]
OPENERS = ["Esse aqui é o", "Conhece o", "Olha só o", "Apresento o"]


def claude_script(p, listing, feed, seed):
    """Roteiro sob medida com o Claude (se ANTHROPIC_API_KEY): mesma estrutura, conteúdo do produto."""
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        return None
    ask = {
        "produto": listing["title"], "marca": p.get("brand"), "categoria": p.get("category"),
        "atributos": listing.get("attributes"), "beneficios": listing.get("bullets"), "ganchos_existentes": feed.get("hooks"),
        "variacao": seed % 1000,
    }
    prompt = ("Escreva o roteiro de um comercial vertical de 16 a 20 s, estilo TikTok 'uso real', em português do Brasil, "
              "para o produto abaixo. Use SOMENTE dados fornecidos (não invente números, prêmios ou garantias). "
              "Responda só JSON: {\"beats\":[{\"t\":\"gancho|produto|beneficio|resultado|embalagem|cta\",\"fala\":\"...\","
              "\"legenda\":\"MAIÚSCULAS, até 6 palavras, palavra-chave entre * *\",\"cena\":\"prompt em inglês de vídeo 9:16 mostrando "
              "o produto da imagem de referência em uso real nessa etapa, sem texto\"}]}. Exatamente 6 beats nessa ordem; "
              "falas curtas (máx. 12 palavras); a 'variacao' muda o ângulo criativo do gancho.\n" + json.dumps(ask, ensure_ascii=False))
    body = {"model": os.environ.get("AGENT_MODEL", "claude-sonnet-5-5"), "max_tokens": 1500, "messages": [{"role": "user", "content": prompt}]}
    req = urllib.request.Request("https://api.anthropic.com/v1/messages", json.dumps(body).encode(),
                                 {"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"})
    ctx = ssl.create_default_context(cafile=os.environ.get("SSL_CERT_FILE") or None)
    txt = "".join(c.get("text", "") for c in json.loads(urllib.request.urlopen(req, context=ctx, timeout=120).read()).get("content", []))
    j = json.loads(re.search(r"\{.*\}", txt, re.S).group(0))
    beats = []
    for b in j["beats"][:6]:
        cap = re.sub(r"\*([^*]+)\*", lambda m: "|" + YEL + m.group(1), b.get("legenda", "")).strip("|")
        beats.append((b["t"], b["fala"], "" if b["t"] == "cta" else cap.upper(), b.get("cena")))
    return beats


def script_for(p, listing, feed, seed=0):
    """6 trechos: (chave, fala, legendas, prompt da cena). Usa só dados do cadastro/anúncio (nada inventado).
    A estrutura é fixa; gancho, abertura, chamada e ordem dos benefícios variam a cada geração (seed)."""
    rnd = random.Random(seed)
    attrs = listing.get("attributes") or {}
    brand = p.get("brand") or listing.get("brand") or ""
    short = _clean(re.sub(r",(?!\d).*$", "", re.sub(r"\s+para .*$", "", listing["title"])))
    short = re.sub(r"\s+[–-]\s+.*$", "", short)
    ws = short.split()
    cut = next((k for k, w in enumerate(ws) if k >= 2 and re.match(r"^\d", w)), len(ws))
    short = " ".join(ws[:min(cut, 6)])
    bullets = [b for b in listing.get("bullets") or [] if b]
    hooks = [h for h in (feed.get("hooks") or []) if h] or [f"Procurando {short.split()[0].lower()} de verdade"]
    hook = _clean(rnd.choice(hooks)).rstrip("?")
    hook = hook if len(hook) <= 70 else " ".join(hook.split()[:10])
    pool = [_claim(b) for b in bullets if not re.search(r"embala|vácuo|caixa", b, re.I)]
    pool = [x for x in pool if x]
    rnd.shuffle(pool)
    b1 = pool[0] if pool else ""
    b2 = pool[1] if len(pool) > 1 else ""
    peso = attrs.get("Peso líquido") or attrs.get("Peso") or ""
    emb = next((b for b in bullets if re.search(r"embala|vácuo|caixa|kit", b, re.I)), "")
    emb_line = _claim(emb) if emb else (f"{peso}, pronto para usar" if peso else "Pronto para usar")
    opener = rnd.choice(OPENERS)
    beats = [
        ("gancho", f"{hook}?", hook.upper() + "?", None),
        ("produto", f"{opener} {short}.", f"{opener.upper()}|{YEL}{short.upper()}", None),
        ("beneficio", f"{b1}.", b1.upper(), None),
        ("resultado", f"{b2}.", b2.upper(), None),
        ("embalagem", f"{emb_line}.", emb_line.upper(), None),
        ("cta", rnd.choice(CTAS), "", None),
    ]
    info = {"brand": brand, "short": short, "attrs": attrs}
    try:
        ai = claude_script(p, listing, feed, seed)
        if ai and len(ai) == 6:
            return ai, {**info, "roteirista": "claude"}
    except Exception as e:
        print("[comercial] roteiro com IA falhou, usando o padrão:", str(e)[:120])
    return [b for b in beats if _clean(b[1]).strip("?.")], {**info, "roteirista": "padrão"}


def speakable(t):
    """Texto da locução: abreviações por extenso (a legenda continua abreviada)."""
    t = re.sub(r"(\d) ?mm/s", r"\1 milímetros por segundo", t)
    t = re.sub(r"(\d) ?°C", r"\1 graus", t)
    t = re.sub(r"(\d) ?mm\b", r"\1 milímetros", t)
    t = re.sub(r"\b1 kg\b", "1 quilo", t)
    t = re.sub(r"(\d) ?kg\b", r"\1 quilos", t)
    return t


def caption_chunks(text, start, dur):
    """Divide a legenda em blocos de até 3 palavras/20 caracteres, tempo proporcional ao tamanho; último bloco em amarelo."""
    if not text:
        return []
    forced = text.split("|")
    chunks = []
    for part in forced:
        yel = part.startswith(YEL)
        words = part.replace(YEL, "").split()
        cur = []
        for w in words:
            if cur and (len(cur) >= 3 or len(" ".join(cur + [w])) > 20):
                chunks.append([" ".join(cur), yel])
                cur = []
            cur.append(w)
        if cur:
            chunks.append([" ".join(cur), yel])
    if chunks and not any(y for _, y in chunks):
        chunks[-1][1] = True
    total = sum(len(c) + 3 for c, _ in chunks)
    out, t = [], start
    for c, y in chunks:
        d = dur * (len(c) + 3) / total
        out.append((t, t + d, (YEL if y else "") + c))
        t += d
    return out


# ----------------------------------------------------------------------------- imagens
def cutout(img_path, side=1100):
    im = Image.open(img_path).convert("RGB")
    im.thumbnail((side, side), Image.LANCZOS)
    w, h = im.size
    m = im.copy()
    for xy in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (w // 2, h - 1)]:
        ImageDraw.floodfill(m, xy, (255, 0, 255), thresh=18)
    px = m.load()
    alpha = Image.new("L", (w, h), 255)
    ap = alpha.load()
    for y in range(h):
        for x in range(w):
            if px[x, y] == (255, 0, 255):
                ap[x, y] = 0
    alpha = alpha.filter(ImageFilter.GaussianBlur(1.2))
    out = im.convert("RGBA")
    out.putalpha(alpha)
    bb = alpha.point(lambda v: 255 if v > 20 else 0).getbbox()
    return out.crop(bb) if bb else out


def still_white(img_path, out):
    im = Image.open(img_path).convert("RGB")
    bg = Image.new("RGB", (W, H), (255, 255, 255))
    im.thumbnail((1040, 1040), Image.LANCZOS)
    bg.paste(im, ((W - im.width) // 2, (H - im.height) // 2 - 60))
    bg.save(out, quality=92)


def chips_for(attrs):
    keys = ["Peso líquido", "Diâmetro do filamento", "Velocidade de impressão", "Capacidade", "Potência", "Voltagem", "Tamanho", "Material"]
    chips = []
    for k in keys:
        v = attrs.get(k)
        if v and len(chips) < 3:
            v = re.sub(r"^\d+\s*a\s*", "até ", v) if k == "Velocidade de impressão" else v
            chips.append(v[:16])
    return chips


def spec_lines(attrs):
    pairs = [("Temperatura do bico", "Bico"), ("Temperatura da mesa", "Mesa"), ("Ventoinha", "Ventoinha"),
             ("Material", "Material"), ("Cor", "Cor"), ("Garantia", "Garantia"), ("Compatibilidade", "")]
    items = [f"{lab} {attrs[k]}".strip() for k, lab in pairs if attrs.get(k) and len(attrs[k]) <= 22][:4]
    return [" • ".join(items[:2]), " • ".join(items[2:4])] if items else []


def end_card(out, brand, short, attrs, product_png, accent=(255, 106, 0), cta=True):
    bg = Image.new("RGB", (W, H), (12, 12, 14))
    d = ImageDraw.Draw(bg)
    for y in range(H):
        t = y / H
        d.line([(0, y), (W, y)], fill=(int(12 + 26 * t), int(12 + 12 * t), int(14 + 4 * t)))
    bg = bg.convert("RGBA")
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse((120, 560, 960, 1400), fill=(*accent, 120))
    bg.alpha_composite(glow.filter(ImageFilter.GaussianBlur(150)))
    p = product_png.copy()
    r = min(800 / p.height, 900 / p.width)
    p = p.resize((int(p.width * r), int(p.height * r)), Image.LANCZOS)
    bg.alpha_composite(p, ((W - p.width) // 2, 540 + (800 - p.height) // 2))
    d = ImageDraw.Draw(bg)

    def c(txt, y, f, fill):
        d.text(((W - d.textlength(txt, font=f)) / 2, y), txt, font=f, fill=fill)

    if brand:
        c(brand.upper(), 200, font("Poppins-SemiBold.ttf", 44), (255, 140, 40))
    name = attrs.get("Linha") or short
    name = re.sub(rf"\b{re.escape(brand)}\b\s*", "", name, flags=re.I).strip() if brand else name
    name = re.sub(r"^(Filamento|Kit|Produto)\s+", "", name, flags=re.I) or short
    size, lines = 124, [name]
    while size > 84 and d.textlength(name, font=font("Poppins-Bold.ttf", size)) > W - 120:
        size -= 4
    if d.textlength(name, font=font("Poppins-Bold.ttf", size)) > W - 120 and len(name.split()) > 1:
        words, size = name.split(), 104
        cut = min(range(1, len(words)), key=lambda k: abs(len(" ".join(words[:k])) - len(" ".join(words[k:]))))
        lines = [" ".join(words[:cut]), " ".join(words[cut:])]
        while size > 60 and max(d.textlength(x, font=font("Poppins-Bold.ttf", size)) for x in lines) > W - 120:
            size -= 4
    f = font("Poppins-Bold.ttf", size)
    y0 = 255
    for k, ln in enumerate(lines):
        c(ln, y0 + k * int(size * 1.08), f, (255, 255, 255))
    chip_y = int(y0 + len(lines) * size * 1.08 + 28)
    chips = chips_for(attrs)
    f = font("Poppins-SemiBold.ttf", 40)
    widths = [d.textlength(x, font=f) + 56 for x in chips]
    x = (W - (sum(widths) + 24 * (len(chips) - 1))) / 2
    for txt, w in zip(chips, widths):
        cy = chip_y
        d.rounded_rectangle((x, cy, x + w, cy + 64), radius=32, outline=(255, 255, 255, 160), width=3)
        d.text((x + 28, cy + 8), txt, font=f, fill=(235, 235, 235))
        x += w + 24
    if cta:
        d.rounded_rectangle((150, 1420, 930, 1570), radius=75, fill=(254, 44, 85))
        c("TOCA NO CARRINHO", 1462, font("Poppins-Bold.ttf", 60), (255, 255, 255))
        c("e garante o teu", 1600, font("Poppins-Medium.ttf", 44), (230, 230, 230))
    else:
        f2 = font("Poppins-SemiBold.ttf", 42)
        for k, ln in enumerate(spec_lines(attrs)):
            c(ln, 1440 + 70 * k, f2, (255, 255, 255))
    bg.convert("RGB").save(out, quality=94)


def frame_from_image(img_path, out):
    """Imagem -> 9:16 em tela cheia (cover), como nas cenas do comercial; foco levemente acima do centro."""
    im = Image.open(img_path).convert("RGB")
    s = max(W / im.width, H / im.height) * 1.02
    im = im.resize((int(im.width * s), int(im.height * s)), Image.LANCZOS)
    x = (im.width - W) // 2
    y = max(0, min(im.height - H, int((im.height - H) * 0.42)))
    im.crop((x, y, x + W, y + H)).save(out, quality=92)


def detail_crop(img_path, out, k):
    """Sem cenas: recorte de detalhe da foto real (região diferente a cada trecho), em tela cheia 9:16."""
    im = Image.open(img_path).convert("RGB")
    a = im.convert("L").point(lambda v: 255 if v < 245 else 0)
    bb = a.getbbox() or (0, 0, im.width, im.height)
    im = im.crop(bb)
    w, h = im.size
    regions = [(0.0, 0.0, 1.0, 1.0), (0.05, 0.0, 0.75, 0.75), (0.3, 0.2, 1.0, 0.95), (0.15, 0.3, 0.85, 1.0)]
    x0, y0, x1, y1 = regions[k % len(regions)]
    reg = im.crop((int(w * x0), int(h * y0), int(w * x1), int(h * y1)))
    bg = Image.new("RGB", (W, H), (244, 244, 242))
    r = min((W - 80) / reg.width, (H * 0.62) / reg.height)
    reg = reg.resize((int(reg.width * r), int(reg.height * r)), Image.LANCZOS)
    bg.paste(reg, ((W - reg.width) // 2, (H - reg.height) // 2 - 120))
    bg.save(out, quality=92)


# ----------------------------------------------------------------------------- montagem
def captions_ass(out, caps):
    def at(t):
        return f"{int(t // 3600)}:{int(t % 3600 // 60):02d}:{t % 60:05.2f}"
    head = ("[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\nWrapStyle: 0\n[V4+ Styles]\n"
            "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, "
            "Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
            "Style: Cap,Poppins,96,&H00FFFFFF,&H000000FF,&H00101010,&H78000000,-1,0,0,0,100,100,3,0,1,9,4,2,90,90,560,1\n"
            "[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n")
    ev = [f"Dialogue: 0,{at(st)},{at(en)},Cap,,0,0,0,,{{\\fscx85\\fscy85\\t(0,90,\\fscx100\\fscy100)}}{txt}" for st, en, txt in caps]
    open(out, "w", encoding="utf-8").write(head + "\n".join(ev) + "\n")


def build(p, listing, feed, ref_photo, scene_images, work, out_feed, out_produto, tts_fn, clip_fn=None, accent=(255, 106, 0), log=print, seed=None):
    """Gera os 2 vídeos (feed com CTA 1080p e produto ≤ 5 MB) e devolve um resumo."""
    os.makedirs(work, exist_ok=True)
    seed = int(hashlib.sha1(str(seed if seed is not None else random.random()).encode()).hexdigest()[:8], 16)
    beats, info = script_for(p, listing, feed, seed)
    rnd = random.Random(seed)
    # 1) locução por trecho
    voice_parts, durs, provider = [], [], None
    for i, (key, fala, _, _) in enumerate(beats):
        mp3 = os.path.join(work, f"voz_{i}.mp3")
        provider = tts_fn(speakable(fala), mp3)
        voice_parts.append(mp3)
        durs.append(max(1.3, probe_dur(mp3) + 0.18))
    concat = os.path.join(work, "voz_lista.txt")
    open(concat, "w").write("".join(f"file '{v}'\n" for v in voice_parts))
    # cada trecho dura o tamanho da fala (+ respiro); a voz completa é montada com os mesmos respiros
    voice = os.path.join(work, "voz.wav")
    fc = "".join(f"[{i}:a]aresample=48000,apad=whole_dur={d:.3f}[a{i}];" for i, d in enumerate(durs))
    fc += "".join(f"[a{i}]" for i in range(len(durs))) + f"concat=n={len(durs)}:v=0:a=1[out]"
    subprocess.run(["ffmpeg", "-v", "error", "-y", *sum([["-i", v] for v in voice_parts], []), "-filter_complex", fc,
                    "-map", "[out]", voice], check=True)
    total = round(sum(durs), 2)

    # 2) visual de cada trecho
    product_png = cutout(ref_photo)
    card_feed, card_prod = os.path.join(work, "card_feed.jpg"), os.path.join(work, "card_produto.jpg")
    end_card(card_feed, info["brand"], info["short"], info["attrs"], product_png, accent, cta=True)
    end_card(card_prod, info["brand"], info["short"], info["attrs"], product_png, accent, cta=False)
    white = os.path.join(work, "embalagem.jpg")
    emb_img = next((im for im in scene_images if re.search(r"embal|vácuo|unbox", im.get("angle", ""), re.I)), None)
    still_white(emb_img["path"] if emb_img else ref_photo, white)
    used, visuals, ai_clips = set(), [], 0
    what = f"{info['short']} ({p.get('category') or 'produto'})"
    for i, (key, _, _, scene) in enumerate(beats):
        if key == "embalagem":
            visuals.append(("still", white))
            continue
        if key == "cta":
            visuals.append(("card", None))
            continue
        clip = None
        if clip_fn and key in CLIP_PROMPTS:
            try:
                prompt = scene or CLIP_PROMPTS[key].replace("the exact product from the reference image", f"the exact product from the reference image ({what})")
                clip = clip_fn(prompt, ref_photo, os.path.join(work, f"clip_{key}.mp4"))
                ai_clips += 1
            except Exception as e:
                log(f"[comercial] clipe IA '{key}' falhou: {str(e)[:120]}")
        if clip:
            visuals.append(("clip", clip))
            continue
        pref = ANGLE_PREF.get(key, [])
        cand = [im for a in pref for im in scene_images if im.get("angle") == a and im["path"] not in used]
        cand += [im for im in scene_images if im["path"] not in used]
        if cand:
            used.add(cand[0]["path"])
            fr = os.path.join(work, f"frame_{key}.jpg")
            frame_from_image(cand[0]["path"], fr)
            visuals.append(("img", fr))
        else:
            fr = os.path.join(work, f"frame_{key}.jpg")
            detail_crop(ref_photo, fr, i)
            visuals.append(("img", fr))

    # 3) legendas
    caps, t = [], 0.0
    for (key, _, cap, _), d in zip(beats, durs):
        caps += caption_chunks(cap, t + 0.05, d - 0.1)
        t += d
    ass = os.path.join(work, "caps.ass")
    captions_ass(ass, caps)

    # 4) montagem (vídeo + voz + trilha com ducking + whoosh)
    sys.path.insert(0, os.path.join(ROOT, "worker", "pipeline_py"))
    cuts, acc = [], 0.0
    for d in durs[:-1]:
        acc += d
        cuts.append(round(acc, 2))
    sfx = os.path.join(work, "sfx.wav")
    try:
        import fc_audio
        fc_audio.write_sfx([0.0] + cuts, ["slide"] * len(cuts), total, sfx)
    except Exception:
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", f"anullsrc=r=44100:cl=mono", "-t", str(total), sfx], check=True)
    grade = "eq=contrast=1.06:saturation=1.10:gamma=0.98,unsharp=5:5:0.6"
    outs = {}
    for mode, out in (("feed", out_feed), ("produto", out_produto)):
        inputs, chains = [], []
        for i, ((kind, src), d) in enumerate(zip(visuals, durs)):
            if kind == "card":
                src = card_feed if mode == "feed" else card_prod
            if kind == "clip":
                inputs += ["-i", src]
                ln = probe_dur(src) or d
                speed = min(1.0, ln / d)
                chains.append(f"[{i}:v]setpts=PTS/{speed:.4f},fps={FPS},scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},{grade},"
                              f"trim=duration={d:.3f},setpts=PTS-STARTPTS,setsar=1,format=yuv420p[v{i}]")
            else:
                inputs += ["-framerate", str(FPS), "-loop", "1", "-t", f"{d:.3f}", "-i", src]
                moves = [("1.0+0.0016*on", "iw/2-(iw/zoom/2)"), ("1.12-0.0016*on", "iw/2-(iw/zoom/2)"),
                         ("1.08", "iw/2-(iw/zoom/2)-40+on*1.2"), ("1.08", "iw/2-(iw/zoom/2)+40-on*1.2")]
                z, xexp = ("min(1.0+0.0008*on,1.05)", "iw/2-(iw/zoom/2)") if kind in ("card", "still") else moves[(i + seed) % 4]
                chains.append(f"[{i}:v]zoompan=z='{z}':x='{xexp}':y='ih/2-(ih/zoom/2)':d=1:s={W}x{H}:fps={FPS},"
                              f"{grade if kind == 'img' else 'null'},setsar=1,format=yuv420p[v{i}]")
        n = len(visuals)
        has_music = os.path.exists(MUSIC)
        inputs += ["-i", voice] + (["-i", MUSIC] if has_music else []) + ["-i", sfx]
        vi, mi, si = n, n + 1, n + (2 if has_music else 1)
        cap_end = total - durs[-1] if mode == "feed" else total
        fcx = ";".join(chains) + ";" + "".join(f"[v{i}]" for i in range(n)) + \
            f"concat=n={n}:v=1:a=0[vc];[vc]subtitles={ass}:fontsdir={FONTS}[v];"
        fcx += (f"[{vi}:a]aresample=48000,highpass=f=80,equalizer=f=250:t=q:w=1.2:g=-3,equalizer=f=3000:t=q:w=1.4:g=3,"
                f"equalizer=f=9000:t=q:w=1.0:g=1.5,deesser=i=0.3,acompressor=threshold=-20dB:ratio=3:attack=5:release=90:makeup=3,"
                f"apad=whole_dur={total},asplit=2[vox][vkey];")
        if has_music:
            fcx += (f"[{mi}:a]aresample=48000,atrim=0:{total},equalizer=f=2500:t=q:w=1.2:g=-4,volume=0.55,"
                    f"afade=t=out:st={max(0, total - 0.8):.2f}:d=0.8[mus];[mus][vkey]sidechaincompress=threshold=0.04:ratio=5:attack=15:release=250[duck];")
        else:
            fcx += "[vkey]anullsink;"
        fcx += f"[{si}:a]aresample=48000,volume=0.45[sfx];"
        fcx += (f"[duck][vox][sfx]amix=inputs=3" if has_music else "[vox][sfx]amix=inputs=2") + \
            ":duration=first:normalize=0,alimiter=limit=0.95,loudnorm=I=-14:TP=-1:LRA=7[a]"
        size = [] if mode == "feed" else ["-vf", "scale=720:1280"]
        enc = ["-c:v", "libx264", "-preset", "medium", "-crf", "20" if mode == "feed" else "27"]
        tmp = out + ".tmp.mp4"
        subprocess.run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", fcx, "-map", "[v]", "-map", "[a]",
                        "-t", f"{total}", "-r", str(FPS), *enc, "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k",
                        "-ar", "48000", "-movflags", "+faststart", tmp], check=True)
        if mode == "produto":
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", tmp, *size, "-c:v", "libx264", "-preset", "slow", "-crf", "27",
                            "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", out], check=True)
            os.remove(tmp)
            if os.path.getsize(out) > 5 * 1024 * 1024:  # limite do TikTok Shop
                kbps = int((4.6 * 8 * 1024) / total) - 96
                subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", out, "-c:v", "libx264", "-b:v", f"{kbps}k", "-maxrate", f"{kbps}k",
                                "-bufsize", f"{2 * kbps}k", "-c:a", "copy", "-movflags", "+faststart", out + ".b.mp4"], check=True)
                os.replace(out + ".b.mp4", out)
        else:
            os.replace(tmp, out)
        outs[mode] = out
    return {"duracao": total, "voz": provider, "cenas_ia": ai_clips, "roteirista": info.get("roteirista"),
            "roteiro": [{"t": k, "fala": f} for k, f, _, _ in beats],
            "legendas": [c for _, _, c in caps]}
