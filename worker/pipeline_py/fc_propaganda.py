# -*- coding: utf-8 -*-
"""videoType 'propaganda'/'google_ads' — adaptação parametrizada dos spot2_gen/spot3_gen
PROVADOS: copy estilo Apple via Grok (fallback template silencioso), inferência de setor
a partir do briefing (texto livre), 6 cenas no formato DP COMPLETO do reference, motion
prompts pro seedance_2_0, voz/mood pelo tom e keywords pra legenda accent."""
import io
import json
import os
import re
import urllib.request

MALE_VOICE = "pNInz6obpgDQGcFmaJgB"      # comercial/urgente (spot2)
FEMALE_VOICE = "21m00Tcm4TlvDq8ikWAM"    # Rachel — emocional/sensorial (spot3)

SCENE_ORDER = ["s1_macro", "s2_prep", "s3_pro", "s4_experience", "s5_scale", "s6_golden"]

# Cena 3 pode virar FOTO REAL da marca (brand.photos[0]) no lugar da gerada.
REAL_SCENE = "s3_pro"

# Motion 'b3_caio' do reference/spot4_gen.py: movimento sutil que preserva o
# rosto (sujeito/luz generalizados pra qualquer marca, resto idêntico).
REAL_SCENE_MOTION = ("Subtle confident motion: the person nods slightly, natural "
                     "breathing, ambient light steady, gentle handheld "
                     "micro-movement, face unchanged.")

_FEM_TOKENS = ("emocional", "sensorial", "acolhedor", "calm", "suave",
               "delicad", "feminin", "zen", "relax", "sereno", "serena")


def _clean(s):
    return re.sub(r"\s+", " ", (s or "").strip())


# ---------------------------------------------------------------- setor
_SECTOR_KEYWORDS = (
    ("wellness", ("spa", "massagem", "estética", "estetica", "bem-estar", "beleza",
                  "salão", "salao", "terapia", "relaxamento", "skincare", "barbearia",
                  "yoga", "pilates")),
    ("tech", ("celular", "iphone", "smartphone", "notebook", "computador", "tecnologia",
              "software", "aplicativo", "aparelho", "equipamento", "internet",
              "sistema", "automação", "automacao", "inteligência artificial",
              "inteligencia artificial", "locação de", "locacao de")),
    ("food", ("restaurante", "comida", "gastronomia", "café", "cafe", "hamburgue",
              "pizza", "delivery", "chef", "cozinha", "padaria", "confeitaria",
              "churrasc", "lanchonete")),
    ("health", ("clínica", "clinica", "saúde", "saude", "médic", "medic", "dentista",
                "odonto", "veterinár", "veterinar", "pet", "hospital", "fisioterapia",
                "psicolog", "nutri", "estét facial")),
    ("corporate", ("advocacia", "advogad", "jurídic", "juridic", "contáb", "contab",
                   "consultoria", "financeir", "seguro", "imobiliár", "imobiliar",
                   "corretora", "escritório", "escritorio", "licitaç", "licitac")),
    ("retail", ("loja", "e-commerce", "ecommerce", "moda", "roupa", "varejo",
                "calçad", "calcad", "acessórios", "acessorios", "presente",
                "livraria", "boutique")),
)


def infer_sector(spec):
    """Setor inferido do briefing em texto livre (oferta/objetivo/observações/marca)."""
    brand = spec.get("brand") or {}
    br = spec.get("briefing") or {}
    text = " ".join(_clean(x) for x in (
        br.get("oferta"), br.get("objetivo"), br.get("observacoes"),
        brand.get("tagline"), brand.get("name"))).lower()
    for name, kws in _SECTOR_KEYWORDS:
        if any(k in text for k in kws):
            return name
    return "services"


def pick_voice_and_mood(spec):
    """tom → (voz elevenlabs, voz edge fallback, mood da trilha, voice_settings).
    comercial/urgente/default = masculina + booms 80bpm (spot2);
    emocional/sensorial = Rachel + sinos 68bpm (spot3). Spa sem tom declarado = feminina."""
    br = spec.get("briefing") or {}
    tom = _clean(br.get("tom")).lower()
    fem = any(t in tom for t in _FEM_TOKENS) or (not tom and infer_sector(spec) == "wellness")
    if fem:
        return (FEMALE_VOICE, "pt-BR-FranciscaNeural", "sinos",
                {"stability": 0.6, "similarity_boost": 0.8, "style": 0.2})
    return (MALE_VOICE, "pt-BR-AntonioNeural", "booms",
            {"stability": 0.55, "similarity_boost": 0.8, "style": 0.25})


# ---------------------------------------------------------------- copy (Grok)
def _fallback_copy(spec):
    brand = spec.get("brand") or {}
    br = spec.get("briefing") or {}
    name = _clean(brand.get("name")) or "Sua Marca"
    tagline = _clean(brand.get("tagline")).rstrip(".")
    oferta = _clean(br.get("oferta")).rstrip(".")
    objetivo = _clean(br.get("objetivo")).rstrip(".")
    vo = [
        ("%s. Como você nunca viu." % oferta) if oferta else "Cada detalhe, pensado pra você.",
        ("%s, com a %s." % (oferta, name)) if oferta else ("Conheça a %s." % name),
        ("%s." % objetivo) if objetivo else "Feito pra facilitar a sua vida.",
        "Uma experiência à altura do que você merece.",
        "Por que esperar pra viver isso?",
        "%s. %s." % (name, tagline or "Você em boas mãos"),
    ]
    return {"vo": vo}


def build_spot_copy(spec):
    """Copy estilo Apple: 6 frases pt-BR de 4-9 palavras, arco fixo (abertura sensorial →
    marca+oferta → benefício → experiência → pergunta retórica → assinatura). Grok com
    fallback template silencioso; observações do briefing entram como restrições."""
    fallback = _fallback_copy(spec)
    key = os.environ.get("XAI_API_KEY")
    if not key:
        print("[copy] sem XAI_API_KEY — usando template", flush=True)
        return fallback
    brand = spec.get("brand") or {}
    br = spec.get("briefing") or {}
    name = _clean(brand.get("name")) or "Sua Marca"
    obs = _clean(br.get("observacoes"))
    user = (
        "Propaganda cinematografica 35s da %s: %s. Objetivo: %s. Tom: %s. CTA final: %s. "
        % (name,
           _clean(br.get("oferta")) or _clean(br.get("objetivo")) or "servicos premium",
           _clean(br.get("objetivo")) or "-",
           _clean(br.get("tom")) or "premium",
           _clean(br.get("cta")) or "fale com a gente"))
    if obs:
        user += "Restricoes obrigatorias (respeite a risca): %s. " % obs
    user += (
        'JSON: {"vo": ["..."]} — 6 frases pt-BR de 4-9 palavras, tom Apple: '
        "1 abertura sensorial sobre a oferta; 2 nomeia a marca e a oferta; "
        "3 beneficio principal ligado ao objetivo; 4 diferencial ou experiencia; "
        "5 pergunta retorica de virada rumo ao CTA; "
        "6 assinatura '%s.' + 3 palavras de fechamento." % name)
    try:
        payload = {
            "model": os.environ.get("XAI_MODEL", "grok-4"),
            "temperature": 0.75,
            "messages": [
                {"role": "system",
                 "content": "Voce escreve locucao de propaganda premium estilo Apple no "
                            "Brasil: frases curtissimas, pausadas, elegantes, poderosas. "
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
        vo = [_clean(x) for x in (json.loads(content).get("vo") or []) if _clean(x)]
        if len(vo) < 6:
            raise ValueError("menos de 6 frases")
        print("[copy] grok ok: %s" % " | ".join(vo[:2]), flush=True)
        return {"vo": vo[:6]}
    except Exception as e:
        print("[copy] grok falhou (%s) — usando template" % str(e)[:120], flush=True)
        return fallback


# ---------------------------------------------------------------- cenas DP
_SECTOR_SCENES = {
    "tech": dict(
        place="a modern technology operations hub with graphite shelves and glass partitions",
        hero="the hero device of {biz} standing at a dramatic diagonal in a black studio void, brushed metal edges and glass catching the rim light",
        prep="two hands in black microfiber gloves lifting one pristine device from a foam-lined flight case where identical units remain seated in cut slots, warehouse depth behind",
        pro="a confident professional in a tailored charcoal suit walking through a modern glass office corridor while checking a premium device linked to {oferta}",
        client="a smiling attendant solving {oferta} for a client with a premium device at a sleek counter, warm bokeh wall of lights behind",
        scale="a long prep bench with identical devices of {biz} standing upright in a precise receding line, a technician's hand adjusting the nearest one, scale and order",
        golden="a young professional on a rooftop terrace at golden hour smiling at a confirmation of {oferta} on a device screen, city skyline soft behind"),
    "wellness": dict(
        place="a serene spa suite in warm beige tones with candles and brass details",
        hero="warm water cascading in a smooth ribbon over dark hair in a ceramic spa basin, fine steam rising, droplets catching golden light like beads, evoking {oferta}",
        prep="a therapist's hands arranging warm towels, smooth basalt stones and amber oil bottles on a wooden tray, candle flames breathing in soft depth",
        pro="a therapist of {biz} in gentle precise movements during a treatment, warm candlelight pools wrapping the scene",
        client="a woman reclined with serene closed eyes receiving {oferta}, warm beige linens and gold-trimmed details, candles in soft depth",
        scale="the serene treatment suite of {biz}: a made massage bed with cream linens, lit candles clustered on a wooden tray, folded towels, soft steam drifting",
        golden="a woman in a cream robe by a sheer-curtained window after her session, holding a warm cup of tea, eyes softly closed in a content smile"),
    "food": dict(
        place="a warm artisan kitchen with copper pans and wooden counters",
        hero="the signature dish of {biz} steaming on a dark stone slab, oil speculars and fresh herbs catching the rim light",
        prep="a chef's hands finishing a plate with precise movements, a flame flaring softly on a burner behind",
        pro="a chef of {biz} working the pass with calm authority, plates flowing under warm pendant light",
        client="a client closing the eyes at the first taste of {oferta} at a candle-lit table, warm bokeh behind",
        scale="a long marble counter with a precise line of finished plates of {biz}, a hand adjusting the nearest garnish, order and abundance",
        golden="friends laughing around an outdoor table at golden hour with {oferta} between them, string lights starting to glow"),
    "health": dict(
        place="a bright modern clinic with soft wood panels and glass",
        hero="precision instruments of {biz} arranged on a spotless steel tray, brushed metal catching the rim light",
        prep="gloved hands of a specialist preparing equipment with precision, clean depth behind",
        pro="a specialist of {biz} in a bright consultation room attending with a warm confident smile",
        client="a patient smiling with relief while receiving {oferta}, soft daylight wrapping the scene",
        scale="a bright corridor of {biz} with a receding line of well-equipped rooms, order and calm",
        golden="a patient stepping out of the glass door at golden hour, relaxed and smiling after {oferta}"),
    "corporate": dict(
        place="an elegant executive office with dark wood, glass and brass details",
        hero="a fountain pen resting on an embossed leather folder of {biz}, fine textures catching the rim light",
        prep="hands organizing documents and a laptop on a dark wood desk, city light glowing beyond the glass",
        pro="a confident advisor of {biz} walking through a glass corridor in a tailored suit, city haze behind",
        client="a firm handshake between advisor and client across an elegant desk sealing {oferta}, warm lamps glowing",
        scale="a long meeting table of {biz} in perfect order, chairs receding in one-point perspective toward the skyline window",
        golden="an executive by a floor-to-ceiling window at golden hour, skyline glowing, quiet confident smile after {oferta}"),
    "retail": dict(
        place="a curated boutique store with warm spotlights and clean shelves",
        hero="the hero product of {biz} on a dark pedestal, textures and edges catching the rim light",
        prep="hands carefully wrapping a purchase in tissue paper and ribbon at a clean counter",
        pro="a stylish attendant of {biz} arranging a display with precision, warm spotlights pooling",
        client="a delighted client discovering {oferta} in the store mirror, warm bokeh behind",
        scale="a receding line of perfectly arranged products of {biz} under even warm light, order and abundance",
        golden="a client leaving the store at golden hour with an elegant bag, smiling, warm flare licking the lens"),
    "services": dict(
        place="a bright modern service space with warm pendant lights",
        hero="the essential tool of the craft of {biz} on a dark surface, worn honest textures catching the rim light",
        prep="skilled hands preparing tools and materials of {biz} with precise confident movements",
        pro="a professional of {biz} in action performing {oferta}, focused and calm",
        client="a smiling client being welcomed at the counter of {biz}, natural gestures, warm light",
        scale="the full workspace of {biz} in perfect order, stations receding in one-point perspective",
        golden="a satisfied client stepping out of the glass door at golden hour after {oferta}, relaxed and smiling"),
}


def _biz(spec):
    brand = spec.get("brand") or {}
    br = spec.get("briefing") or {}
    name = _clean(brand.get("name")) or "the brand"
    oferta = _clean(br.get("oferta")) or _clean(br.get("objetivo")) or "premium services"
    return "%s, a Brazilian business offering %s" % (name, oferta), oferta


def sector_fragments(spec):
    """Fragmentos de SUBJECT do setor inferido, já preenchidos com marca/oferta."""
    biz, oferta = _biz(spec)
    sc = _SECTOR_SCENES[infer_sector(spec)]
    return {k: v.format(biz=biz, oferta=oferta) for k, v in sc.items()}, oferta


def build_spot_scenes(spec):
    """6 cenas no formato DP COMPLETO dos spot2/spot3 PROVADOS (arco: macro hero →
    preparo → profissional → experiência do cliente → escala → golden hour) + motions."""
    f, _oferta = sector_fragments(spec)
    place = f["place"]
    P = {}

    P["s1_macro"] = """CAMERA: IMAX MK IV 65mm, ISO 250, macro position centimeters from the subject, low oblique angle.
LENS: Zeiss Makro-Planar 65mm T2.2, critical focus on the hero texture.
LIGHT: single narrow warm rim strip at 2.900K raking from camera-right, deep black studio void, edge highlights at 90 IRE, everything else falling under 8 IRE.
SUBJECT: {subject}.
FOREGROUND: soft out-of-focus reflection of the subject on dark acrylic below.
MIDGROUND: the hero detail, razor sharp.
BACKGROUND: pure black falling to nothing.
WARDROBE TONAL BEHAVIOR: real material micro texture with fine anisotropic grain and tiny speculars along the rim.
MAKEUP SURFACE PHYSICS: real material physics, no retouching.
POST BEHAVIOR: Kodak 2383 print emulation, visible tactile grain, strong halation on rim highlights, deep blacks.
COMPOSITIONAL GEOMETRY: subject diagonal from lower-left to upper-right, negative black space dominating two thirds.
MOOD & ART DIRECTION: Composition and art direction inspired in the work of award-winning directors.""".format(subject=f["hero"])

    P["s2_prep"] = """CAMERA: ARRI Alexa 35, ISO 800, low position at work height, shooting across the action.
LENS: Canon K35 55mm T1.5, sixty centimeters, focus on the hands.
LIGHT: cool clean key at 5.000K from above, warm practical glow at 3.000K inside the near edge, hands at 65 IRE.
SUBJECT: {subject}. Intercepted framing, forearm crossing the lower corner.
FOREGROUND: defocused near edge catching a specular.
MIDGROUND: the hands and materials, sharp.
BACKGROUND: {place} in soft bokeh.
WARDROBE TONAL BEHAVIOR: matte fabrics absorbing light, key materials glowing against them.
MAKEUP SURFACE PHYSICS: real skin and material texture, no retouching.
POST BEHAVIOR: Kodak Vision3 500T 5219, visible organic grain, mild halation, cool-warm split.
COMPOSITIONAL GEOMETRY: action diagonal, main element at upper-right power point.
MOOD & ART DIRECTION: Composition and art direction inspired in the work of award-winning directors.""".format(subject=f["prep"], place=place)

    P["s3_pro"] = """CAMERA: ARRI Alexa 35, ISO 800, hip-level tracking position beside the subject, slight low angle.
LENS: Canon K35 35mm T1.5, one and a half meters, focus on the subject.
LIGHT: late daylight through glass at 5.200K camera-left, long soft shadows across the floor, face at 60 IRE with window rim.
SUBJECT: {subject}. Intercepted framing, vertical elements crossing the frame.
FOREGROUND: defocused glass reflection sliding past.
MIDGROUND: subject mid-action, sharp.
BACKGROUND: {place} depth, silhouettes in soft bokeh.
WARDROBE TONAL BEHAVIOR: matte garments, one single color accent.
MAKEUP SURFACE PHYSICS: real skin texture, subtle natural sheen, no retouch.
POST BEHAVIOR: Kodak Vision3 250D 5207, visible organic grain, clean highlight rolloff, neutral grade.
COMPOSITIONAL GEOMETRY: subject on right thirds moving left-to-right, leading space ahead.
MOOD & ART DIRECTION: Composition and art direction inspired in the work of award-winning directors.""".format(subject=f["pro"], place=place)

    P["s4_experience"] = """CAMERA: ARRI Alexa 35, ISO 800, low position at eye height of the key moment.
LENS: Canon K35 55mm T1.5, eighty centimeters, focus on the key gesture.
LIGHT: warm tungsten glow at 3.200K on faces, cool wash at 6.000K deep background, faces at 60 IRE.
SUBJECT: {subject}. Intercepted framing.
FOREGROUND: defocused warm element catching speculars.
MIDGROUND: the key gesture, sharp.
BACKGROUND: dense golden bokeh, silhouettes mingling in depth.
WARDROBE TONAL BEHAVIOR: soft fabrics with warm speculars, deep tones absorbing.
MAKEUP SURFACE PHYSICS: real skin sheen under warm light, no retouching.
POST BEHAVIOR: Kodak Vision3 500T 5219, visible organic grain, strong halation on bokeh, warm-cool contrast.
COMPOSITIONAL GEOMETRY: key moment at center power point, bokeh field upper two thirds.
MOOD & ART DIRECTION: Composition and art direction inspired in the work of award-winning directors.""".format(subject=f["client"])

    P["s5_scale"] = """CAMERA: IMAX MK IV 65mm, ISO 250, low oblique position, shooting down the length of the space.
LENS: Leica Summilux-C 40mm T1.4, one meter, focus deep in the receding line.
LIGHT: clean even key at 5.000K overhead, even field at 75 IRE, thin soft shadows.
SUBJECT: {subject}.
FOREGROUND: first elements dissolving out of focus.
MIDGROUND: the receding order, third to eighth elements sharp.
BACKGROUND: {place} depth in bokeh.
WARDROBE TONAL BEHAVIOR: repeating textures like a pattern, matte surfaces.
MAKEUP SURFACE PHYSICS: real textures, no retouching.
POST BEHAVIOR: Kodak Vision3 250D 5207, visible organic grain, flat even field with deep perspective.
COMPOSITIONAL GEOMETRY: one-point perspective line receding to an upper vanishing point.
MOOD & ART DIRECTION: Composition and art direction inspired in the work of award-winning directors.""".format(subject=f["scale"], place=place)

    P["s6_golden"] = """CAMERA: ARRI Alexa 35, ISO 800, low angle from waist height at golden hour.
LENS: Canon K35 35mm T1.5, one meter, focus on the smile.
LIGHT: low golden sun at 3.000K raking from camera-left, warm rim on hair and edges, face at 65 IRE, long shadows.
SUBJECT: {subject}. Intercepted framing, near edge crossing the lower frame.
FOREGROUND: defocused near edge with warm speculars.
MIDGROUND: subject, sharp.
BACKGROUND: golden haze bokeh depth.
WARDROBE TONAL BEHAVIOR: soft fabric catching warm rim light on the shoulders.
MAKEUP SURFACE PHYSICS: real skin, warm sheen on the cheekbone, no retouching.
POST BEHAVIOR: Kodak Vision3 250D 5207, visible organic grain, gentle halation on the sun edge, golden midtone priority.
COMPOSITIONAL GEOMETRY: subject right thirds, horizon band lower third, sun flare intrusion upper-left.
MOOD & ART DIRECTION: Composition and art direction inspired in the work of award-winning directors.""".format(subject=f["golden"])

    M = {
        "s1_macro": "Extremely slow macro orbit across the hero surface, rim light sweeping along the edges, faint dust motes drifting in the black void, reflections gliding on the acrylic below.",
        "s2_prep": "Slow push-in as the hands work with precision, surrounding depth settling in soft focus, warehouse light shifting gently.",
        "s3_pro": "Smooth lateral tracking with the professional in stride, window light strobing softly through the glass, a brief glance down and ahead again.",
        "s4_experience": "Steady push toward the key moment, a soft smile landing, warm bokeh breathing behind, gentle natural gestures.",
        "s5_scale": "Slow dolly along the receding line, elements coming alive in sequence as the camera passes, perspective deepening.",
        "s6_golden": "Gentle rise and slow push as the subject smiles, sun flare sweeping across the lens, breeze moving fabric softly.",
    }
    return P, M


# ---------------------------------------------------------------- cena real
def prepare_real_scene(spec, dest, landscape=False):
    """Se brand.photos é lista não-vazia, baixa photos[0] do bucket público
    'assets' e prepara o canvas fit + fundo blur escuro (port EXATO do preparo
    da 'cena real do Caio' em reference/spot4_gen.py). True = a foto real vira
    a CENA 3 no lugar da gerada; False = segue com a cena gerada (só aviso)."""
    photos = (spec.get("brand") or {}).get("photos") or []
    if not isinstance(photos, (list, tuple)) or not photos:
        return False
    try:
        from PIL import Image, ImageFilter
        ref = str(photos[0]).strip()
        if ref.startswith("http://") or ref.startswith("https://"):
            url = ref
        else:
            base = (os.environ.get("SUPABASE_URL") or "").rstrip("/")
            if not base:
                raise RuntimeError("SUPABASE_URL ausente no ambiente")
            url = "%s/storage/v1/object/public/assets/%s" % (base, ref.lstrip("/"))
        with urllib.request.urlopen(url, timeout=120) as r:
            data = r.read()
        foto = Image.open(io.BytesIO(data)).convert("RGB")
        CW, CH = (2752, 1536) if landscape else (1536, 2752)
        bg = None
        if foto.height * CW / foto.width >= CH:
            bg = (foto.resize((CW, int(foto.height * CW / foto.width)), Image.LANCZOS)
                  .filter(ImageFilter.GaussianBlur(40)).crop((0, 0, CW, CH)))
        canvas = Image.new("RGB", (CW, CH), (13, 13, 13))
        if bg:
            canvas.paste(bg, (0, 0))
        ratio = min(CW / foto.width, CH / foto.height)
        f2 = foto.resize((int(foto.width * ratio), int(foto.height * ratio)),
                         Image.LANCZOS)
        canvas.paste(f2, ((CW - f2.width) // 2, (CH - f2.height) // 2))
        canvas.save(dest)
        print("[cena real] foto da marca ok -> %s (%dx%d)" % (dest, CW, CH),
              flush=True)
        return True
    except Exception as e:
        print("[cena real] aviso: download/preparo falhou (%s) — seguindo com "
              "cena gerada" % str(e)[:150], flush=True)
        return False


# ---------------------------------------------------------------- keywords (legenda)
_STOPWORDS = {"de", "da", "do", "das", "dos", "para", "pra", "com", "sem", "por",
              "que", "uma", "um", "seu", "sua", "seus", "suas", "em", "no", "na",
              "nos", "nas", "ao", "aos", "mais", "como", "você", "voce", "the",
              "and", "of", "todos", "toda", "todo", "sobre", "entre", "muito"}


def caption_keywords(spec):
    """Keywords pra colorir na legenda (nome da marca + termos fortes do briefing)."""
    brand = spec.get("brand") or {}
    br = spec.get("briefing") or {}
    kws = []
    name = _clean(brand.get("name"))
    if name:
        kws.append(name)
        kws += [w for w in name.split() if len(w) >= 4]
    for field in ("oferta", "objetivo", "cta"):
        for w in _clean(br.get(field)).replace(",", " ").split():
            wl = w.strip(".!?:;()").lower()
            if len(wl) >= 5 and wl not in _STOPWORDS:
                kws.append(w.strip(".!?:;()"))
    seen = set()
    out = []
    for k in kws:
        kl = k.lower()
        if kl and kl not in seen:
            seen.add(kl)
            out.append(k)
    return out[:16]
