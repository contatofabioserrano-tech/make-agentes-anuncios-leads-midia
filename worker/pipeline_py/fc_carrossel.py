# -*- coding: utf-8 -*-
"""videoType 'carrossel' — 10 artes 4:5 (1080x1350):
Grok gera {slides:[{titulo,texto_curto}] x10} (capa forte, 8 conteúdo, CTA final; fallback
template silencioso); 1 imagem nano_banana_2 4:5 por slide (prompt DP simplificado coerente
com marca/briefing, SEM texto na imagem); composição Pillow: gradiente escuro (primary),
título Poppins-Bold, texto Poppins-Medium, barra accent, logo pequeno e numeração."""
import json
import os
import re
import urllib.request

from PIL import Image, ImageDraw

from fc_cards import font
from fc_common import darken
from fc_propaganda import sector_fragments

CW, CH = 1080, 1350
N_SLIDES = 10
WHITE = (255, 255, 255)


def _clean(s):
    return re.sub(r"\s+", " ", (s or "").strip())


# ---------------------------------------------------------------- copy (Grok)
def _fallback_slides(spec):
    brand = spec.get("brand") or {}
    br = spec.get("briefing") or {}
    name = _clean(brand.get("name")) or "Sua Marca"
    tagline = _clean(brand.get("tagline")).rstrip(".")
    oferta = _clean(br.get("oferta")).rstrip(".")
    objetivo = _clean(br.get("objetivo")).rstrip(".")
    tom = _clean(br.get("tom")).rstrip(".")
    cta = _clean(br.get("cta")).rstrip(".") or "Fale com a gente"
    capa = {"titulo": oferta or objetivo or name,
            "texto_curto": tagline or "Arrasta pro lado e descobre."}
    mids = [
        ("Por que agora", objetivo or "Porque adiar custa caro."),
        ("O que oferecemos", oferta or "Solução completa, sem complicação."),
        ("Como funciona", "Você fala com a gente, o resto é por nossa conta."),
        ("O diferencial", tom.capitalize() if tom else "Atendimento de verdade, do começo ao fim."),
        ("Pra quem é", "Pra quem quer resultado sem dor de cabeça."),
        ("O que você ganha", "Tempo, tranquilidade e qualidade."),
        ("Na prática", oferta or "Do primeiro contato à entrega, tudo resolvido."),
        ("Dica", "Salva este post pra não perder."),
    ]
    final = {"titulo": cta.upper(),
             "texto_curto": _clean(brand.get("address")) or tagline or name}
    return [capa] + [{"titulo": t, "texto_curto": x} for t, x in mids] + [final]


def build_slides(spec):
    """Sempre retorna EXATAMENTE 10 slides {titulo, texto_curto}."""
    fallback = _fallback_slides(spec)
    key = os.environ.get("XAI_API_KEY")
    if not key:
        print("[slides] sem XAI_API_KEY — usando template", flush=True)
        return fallback
    brand = spec.get("brand") or {}
    br = spec.get("briefing") or {}
    name = _clean(brand.get("name")) or "Sua Marca"
    obs = _clean(br.get("observacoes"))
    user = (
        "Carrossel de Instagram com EXATAMENTE 10 slides para %s: %s. "
        "Objetivo: %s. Tom: %s. CTA: %s. "
        % (name,
           _clean(br.get("oferta")) or _clean(br.get("objetivo")) or "servicos premium",
           _clean(br.get("objetivo")) or "-",
           _clean(br.get("tom")) or "premium",
           _clean(br.get("cta")) or "fale com a gente"))
    if obs:
        user += "Restricoes obrigatorias (respeite a risca): %s. " % obs
    user += (
        'JSON: {"slides":[{"titulo":"...","texto_curto":"..."}]} — 10 itens pt-BR: '
        "slide 1 capa com gancho forte (titulo max 6 palavras); "
        "slides 2-9 conteudo que educa e vende (titulo max 5 palavras, "
        "texto_curto max 18 palavras); slide 10 CTA claro. Sem emojis, sem hashtags.")
    try:
        payload = {
            "model": os.environ.get("XAI_MODEL", "grok-4"),
            "temperature": 0.7,
            "messages": [
                {"role": "system",
                 "content": "Voce escreve carrosseis de Instagram de alta conversao no "
                            "Brasil: direto, especifico, sem clickbait vazio. "
                            "Responda APENAS JSON valido, sem markdown."},
                {"role": "user", "content": user},
            ],
        }
        req = urllib.request.Request(
            "https://api.x.ai/v1/chat/completions",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=120) as r:
            content = json.loads(r.read().decode("utf-8", errors="replace"))[
                "choices"][0]["message"]["content"]
        content = re.sub(r"^```(json)?|```$", "", content.strip(), flags=re.M).strip()
        raw = json.loads(content).get("slides") or []
        slides = [{"titulo": _clean(s.get("titulo")), "texto_curto": _clean(s.get("texto_curto"))}
                  for s in raw if isinstance(s, dict) and _clean(s.get("titulo"))]
        if not slides:
            raise ValueError("sem slides validos")
        while len(slides) < N_SLIDES:  # completa com o template (mantém capa+CTA coerentes)
            slides.insert(len(slides) - 1, fallback[len(slides) - 1])
        print("[slides] grok ok: %s" % slides[0]["titulo"], flush=True)
        return slides[:N_SLIDES]
    except Exception as e:
        print("[slides] grok falhou (%s) — usando template" % str(e)[:120], flush=True)
        return fallback


# ---------------------------------------------------------------- prompts (imagens)
_ANGLES = ["low-angle position near the ground tilted up",
           "hip-level lateral position",
           "macro position centimeters from the surface",
           "over-the-shoulder position slightly below eye line",
           "three-quarter position at chest height",
           "top-down position above the work surface",
           "low oblique position shooting down the length of the space",
           "waist-level position by a large window",
           "floor-level position with deep perspective",
           "slight high angle at counter height"]
_LIGHTS = ["low golden sun at 3.000K raking from camera-left, long warm shadows",
           "large window daylight at 5.400K camera-right as key, soft bounce fill",
           "single practical lamp at 2.900K, hard falloff into deep shadow, zero fill",
           "cool clean LED key at 5.000K overhead, even field, thin soft shadows",
           "warm tungsten pools at 3.200K with cool wash at 6.000K deep background"]


def build_slide_prompts(spec):
    """10 prompts DP simplificados (CAMERA/LENS/LIGHT/SUBJECT/POST/MOOD), coerentes com
    o setor inferido do briefing e SEM texto na imagem (o texto entra via Pillow)."""
    fr, oferta = sector_fragments(spec)
    subjects = [
        fr["hero"],
        "the full ambient of " + fr["place"],
        fr["prep"],
        fr["pro"],
        fr["client"],
        fr["scale"],
        fr["golden"],
        "an extreme close texture detail related to " + oferta,
        "a warm candid teamwork moment inside " + fr["place"],
        "a clean still-life arrangement representing " + oferta + " on a textured dark surface",
    ]
    P = {}
    for i, subj in enumerate(subjects, 1):
        P["slide_%02d" % i] = (
            "CAMERA: ARRI Alexa 35, ISO 800, %s. "
            "LENS: Canon K35 55mm T1.5, shallow focus on the key element. "
            "LIGHT: %s. "
            "SUBJECT: %s, absolutely no text, no letters, no numbers, no logos, "
            "no watermarks anywhere in the frame. "
            "POST BEHAVIOR: Kodak Vision3 250D 5207, visible organic grain, clean "
            "highlight rolloff, restrained contrast. "
            "MOOD & ART DIRECTION: Composition and art direction inspired in the work "
            "of award-winning directors."
            % (_ANGLES[(i - 1) % len(_ANGLES)], _LIGHTS[(i - 1) % len(_LIGHTS)], subj))
    return P


# ---------------------------------------------------------------- composição (Pillow)
def _cover(img):
    r = max(CW / img.width, CH / img.height)
    img = img.resize((int(img.width * r + 0.5), int(img.height * r + 0.5)), Image.LANCZOS)
    x = (img.width - CW) // 2
    y = (img.height - CH) // 2
    return img.crop((x, y, x + CW, y + CH))


def _wrap(d, text, f, maxw, maxlines):
    words = text.split()
    lines, cur = [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if cur and d.textlength(t, font=f) > maxw:
            lines.append(cur)
            cur = w
        else:
            cur = t
    if cur:
        lines.append(cur)
    if len(lines) > maxlines:
        lines = lines[:maxlines]
        lines[-1] += "…"
    return lines


def compose_slides(slides, colors, logo_path, imgdir, outdir):
    """Compõe out/slide_01..10.png: imagem cover + gradiente escuro do primary +
    barra accent + título + texto + logo pequeno + numeração em pill."""
    prim, _, accent = colors
    shade = darken(prim, 0.6)
    logo = Image.open(logo_path).convert("RGBA")
    lh = 88
    lw = max(1, int(logo.width * lh / logo.height))
    small = logo.resize((lw, lh), Image.LANCZOS)
    os.makedirs(outdir, exist_ok=True)
    for i, s in enumerate(slides, 1):
        base = Image.open(os.path.join(imgdir, "slide_%02d.png" % i)).convert("RGB")
        img = _cover(base).convert("RGBA")
        grad = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
        gd = ImageDraw.Draw(grad)
        y0 = int(CH * 0.42)
        for y in range(y0, CH):
            a = int(235 * ((y - y0) / float(CH - y0)) ** 1.25)
            gd.line([(0, y), (CW, y)], fill=shade + (a,))
        img = Image.alpha_composite(img, grad)
        d = ImageDraw.Draw(img)
        titulo = _clean(s.get("titulo")) or "—"
        texto = _clean(s.get("texto_curto"))
        f_t = font("Poppins-Bold.ttf", 92 if i == 1 else 72)
        f_x = font("Poppins-Medium.ttf", 40)
        maxw = CW - 144
        tl = _wrap(d, titulo, f_t, maxw, 3)
        xl = _wrap(d, texto, f_x, maxw, 3) if texto else []
        lt = int(f_t.size * 1.18)
        lx = int(f_x.size * 1.32)
        y_cursor = CH - 96
        if xl:
            y_cursor -= len(xl) * lx
        y_text = y_cursor
        if xl:
            y_cursor -= 26
        y_cursor -= len(tl) * lt
        y_title = y_cursor
        d.rectangle([(72, y_title - 44), (192, y_title - 36)], fill=accent)
        yy = y_title
        for ln in tl:
            d.text((72, yy), ln, font=f_t, fill=WHITE)
            yy += lt
        yy = y_text
        for ln in xl:
            d.text((72, yy), ln, font=f_x, fill=(235, 235, 235))
            yy += lx
        num = "%02d/%d" % (i, len(slides))
        f_n = font("Poppins-SemiBold.ttf", 36)
        nw = d.textlength(num, font=f_n)
        pad = 22
        x1, y1 = CW - 48 - nw - 2 * pad, 48
        d.rounded_rectangle([(x1, y1), (CW - 48, y1 + 64)], radius=32,
                            fill=(10, 10, 14, 160))
        d.text((x1 + pad, y1 + 12), num, font=f_n, fill=WHITE)
        img.paste(small, (48, 44), small)
        img.convert("RGB").save(os.path.join(outdir, "slide_%02d.png" % i))
        print("slide_%02d.png ok" % i, flush=True)
