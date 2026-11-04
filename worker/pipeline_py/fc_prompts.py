# -*- coding: utf-8 -*-
"""Roteiro: prompts de cena no formato DP (estrutura exata do gen_images2.py PROVADO),
prompts de movimento (kling3_0), copy de locução/kinetic/CTA e refino opcional via xAI."""
import json
import os
import re
import urllib.request


def _clean(s):
    return re.sub(r"\s+", " ", (s or "").strip())


def _first_words(s, n):
    return " ".join(_clean(s).split()[:n])


def _lower_first(s):
    s = _clean(s)
    return s[0].lower() + s[1:] if s else s


def _split_cta(cta):
    words = _clean(cta).upper().split()
    if not words:
        return ("FALE COM", "A GENTE")
    if len(words) == 1:
        return (words[0], "")
    total = sum(len(w) for w in words)
    acc = 0
    cut = max(1, len(words) // 2)
    for i, w in enumerate(words[:-1]):
        acc += len(w)
        if acc >= total / 2:
            cut = i + 1
            break
    return (" ".join(words[:cut]), " ".join(words[cut:]))


def build_copy(spec, video_type):
    brand = spec.get("brand") or {}
    br = spec.get("briefing") or {}
    name = _clean(brand.get("name")) or "Sua Marca"
    tagline = _clean(brand.get("tagline")).rstrip(".")
    objetivo = _clean(br.get("objetivo")).rstrip(".")
    oferta = _clean(br.get("oferta")).rstrip(".")
    cta = _clean(br.get("cta")).rstrip(".") or "Fale com a gente"
    tom = _clean(br.get("tom")).rstrip(".")

    if oferta:
        hook = "Procurando %s?" % _lower_first(oferta)
    elif objetivo:
        hook = "%s?" % objetivo
    else:
        hook = "Chegou a hora de dar o próximo passo."

    vo = {
        "vo1": hook,
        "vo2": "Conheça a %s." % name,
        "vo3": ("%s, do jeito certo pra você." % oferta) if oferta
               else "Tudo o que você precisa, em um só lugar.",
        "vo4": ("Atendimento %s, do começo ao fim." % _lower_first(tom)) if tom
               else "Qualidade e atendimento de verdade, do começo ao fim.",
        "vo5": ("%s." % objetivo) if objetivo
               else "Estrutura completa, pronta pra te receber.",
        "vo6": "%s. Você em boas mãos." % name,
        "vo7": "%s. %s.%s" % (cta, name, (" %s." % tagline) if tagline else ""),
    }
    vo_order = (["vo1", "vo2", "vo3", "vo4", "vo5", "vo6", "vo7"]
                if video_type != "reel"
                else ["vo1", "vo2", "vo3", "vo6", "vo7"])

    key = _first_words(oferta, 2).upper() or "QUALIDADE"
    kin = {
        "s1_hook": "[[%s]] PRA VOCÊ" % key,
        "s2_business": "CONHEÇA A [[%s]]" % name.upper(),
        "s3_detail": "FEITO [[DO JEITO CERTO]]",
        "s4_tech": "[[TECNOLOGIA]] E AGILIDADE",
        "s5_final": "EM [[BOAS MÃOS]]",
    }
    l1, l2 = _split_cta(cta)
    return {
        "vo": vo,
        "vo_order": vo_order,
        "kin": kin,
        "cta_phrase": cta,
        "cta_l1": l1,
        "cta_l2": l2,
        "panel1_word": key,
        "panel1_sub": _lower_first(oferta) if oferta else (tagline or "pra você"),
        "panel2_word": (_first_words(objetivo, 2).upper() or "QUALIDADE"),
        "panel2_sub": tagline or "atendimento de verdade",
    }


def xai_refine(copy, spec):
    """Refina hook/CTA via xAI (grok). Fallback silencioso pros templates."""
    key = os.environ.get("XAI_API_KEY")
    if not key:
        return copy
    brand = spec.get("brand") or {}
    br = spec.get("briefing") or {}
    try:
        prompt = (
            "Marca: %s. Objetivo: %s. Oferta: %s. Tom: %s. CTA desejado: %s. "
            "Você escreve copy de comerciais curtos em pt-BR. Responda SOMENTE um JSON válido no formato "
            '{"hook": "pergunta-gancho curta e falada, máximo 9 palavras", '
            '"cta": "frase de chamada pra ação curta, máximo 5 palavras"}.'
        ) % (brand.get("name") or "", br.get("objetivo") or "", br.get("oferta") or "",
             br.get("tom") or "", br.get("cta") or "")
        payload = {
            "model": os.environ.get("XAI_MODEL", "grok-4"),
            "messages": [
                {"role": "system",
                 "content": "Você é copywriter sênior de comerciais de 30 segundos em português do Brasil."},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.7,
        }
        req = urllib.request.Request(
            "https://api.x.ai/v1/chat/completions",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=60) as r:
            j = json.loads(r.read().decode("utf-8", errors="replace"))
        content = j["choices"][0]["message"]["content"]
        m = re.search(r"\{.*\}", content, re.S)
        data = json.loads(m.group(0)) if m else {}
        hook = _clean(data.get("hook"))
        cta = _clean(data.get("cta")).rstrip(".")
        if hook:
            copy["vo"]["vo1"] = hook
        if cta:
            name = _clean(brand.get("name")) or "Sua Marca"
            tagline = _clean(brand.get("tagline")).rstrip(".")
            copy["cta_phrase"] = cta
            copy["cta_l1"], copy["cta_l2"] = _split_cta(cta)
            copy["vo"]["vo7"] = "%s. %s.%s" % (cta, name, (" %s." % tagline) if tagline else "")
        print("[xai] copy refinada (hook/cta)", flush=True)
    except Exception as e:
        print("[xai] falhou (%s) — mantendo templates" % str(e)[:120], flush=True)
    return copy


def _biz_context(spec):
    brand = spec.get("brand") or {}
    br = spec.get("briefing") or {}
    name = _clean(brand.get("name")) or "the brand"
    oferta = _clean(br.get("oferta")) or _clean(br.get("objetivo")) or "premium services"
    obs = _clean(br.get("observacoes"))
    biz = "%s, a Brazilian business offering %s" % (name, oferta)
    if obs:
        biz += " (%s)" % obs[:140]
    return biz, oferta


def build_scene_prompts(spec, reel=False):
    """5 prompts DP — mesma estrutura de blocos do gen_images2.py de referência."""
    biz, need = _biz_context(spec)
    P = {}

    P["s1_hook"] = """CAMERA: ARRI Alexa 35, ISO 800, hip-level position slightly below the subject, tilted up a few degrees from armchair height.
LENS: Canon K35 35mm T1.5, one meter from subject, focus on the eyes, shallow breathing field.
LIGHT: single practical table lamp at 2.900K camera-left, half a meter away, hard falloff into deep shadow camera-right, zero fill, shadows near 10 IRE, feather highlights near 70 IRE.
SUBJECT: a person in their thirties seated at night at a small table, thoughtful tense expression, phone face-down beside them, clearly wishing for {need} — the everyday need answered by {biz}. Intercepted framing, shoulder crossing the lower frame edge.
FOREGROUND: blurred edge of a dark knit blanket dissolving out of focus.
MIDGROUND: the person, focus locked on the eyes.
BACKGROUND: dark living room falling to black, one out-of-focus window with distant sodium streetlight bokeh.
WARDROBE TONAL BEHAVIOR: deep muted cotton sweater absorbing lamp light, no sheen.
MAKEUP SURFACE PHYSICS: real skin texture, visible pores, slight oil on the nose bridge, no retouching.
POST BEHAVIOR: Kodak Vision3 500T 5219, visible organic grain, mild halation around the lamp, lifted blacks, warm midtone priority.
COMPOSITIONAL GEOMETRY: subject weighted to left third, dark negative space right, broken thirds, lamp intruding top-left.
MOOD & ART DIRECTION: Composition and art direction inspired in the work of award-winning directors.""".format(need=need, biz=biz)

    P["s2_business"] = """CAMERA: ARRI Alexa 35, ISO 800, chest-level lateral position, gentle three-quarter angle on the counter.
LENS: Canon K35 55mm T1.5, two meters from subject, focus on the attendant's smile, shallow field.
LIGHT: large window daylight at 5.600K camera-right as key, white bounce fill camera-left two stops under, soft open shadows near 30 IRE.
SUBJECT: a warm welcome moment inside the modern clean space of {biz}: a smiling attendant greets a client across a tidy counter, both mid-conversation with natural gestures.
FOREGROUND: out-of-focus edge of a green plant leaf crossing the lower right corner.
MIDGROUND: attendant and client at the counter, focus on the faces.
BACKGROUND: bright interior with warm pendant lights, depth falling to soft bokeh.
WARDROBE TONAL BEHAVIOR: clean neutral uniforms with a subtle darker accent detail, matte fabric, no sheen.
MAKEUP SURFACE PHYSICS: real skin texture, natural daylight sheen on the cheekbones, no retouching.
POST BEHAVIOR: Kodak Vision3 250D 5207, visible organic grain, clean whites, gentle warm highlight rolloff.
COMPOSITIONAL GEOMETRY: counter running diagonal from lower left to mid right, faces on upper-third intersections, breathing headroom.
MOOD & ART DIRECTION: Composition and art direction inspired in the work of award-winning directors.""".format(biz=biz)

    P["s3_detail"] = """CAMERA: ARRI Alexa 35, ISO 800, tabletop-level position, slight high angle over the work surface.
LENS: Canon K35 85mm T1.5, close focus on the hands, razor-thin field.
LIGHT: single broad softbox dome overhead at 5.000K, soft wrap key, dark negative fill on both sides, controlled speculars near 85 IRE.
SUBJECT: close-up of skilled hands performing the core service of {biz}, precise confident movements, tools and product surfaces catching moving speculars.
FOREGROUND: blurred tool edge crossing the lower corner, dissolving out of focus.
MIDGROUND: hands and product locked in sharp focus.
BACKGROUND: dark clean workspace dissolving to soft shadow.
WARDROBE TONAL BEHAVIOR: matte work garment cuffs, deep tone, no sheen.
MAKEUP SURFACE PHYSICS: real skin texture on the hands, visible knuckle detail, natural dryness.
POST BEHAVIOR: Kodak Vision3 250D 5207, visible organic grain, neutral clean color, restrained contrast.
COMPOSITIONAL GEOMETRY: hands weighted to lower right, action diagonal toward upper left, tight negative space above.
MOOD & ART DIRECTION: Composition and art direction inspired in the work of award-winning directors.""".format(biz=biz)

    P["s4_tech"] = """CAMERA: ARRI Alexa 35, ISO 800, over-the-shoulder position slightly below eye line, angled toward the screen.
LENS: Canon K35 35mm T1.5, focus on the screen plane, faces held soft in the near field.
LIGHT: large monitor glow at 6.500K as the key, dim practical lamps at 3.000K deep in the background, shadows near 15 IRE, zero fill.
SUBJECT: two professionals of {biz} in front of a large monitor reviewing results, one pointing at the interface, cool screen glow washing both faces.
FOREGROUND: dark blurred shoulder crossing the lower frame edge.
MIDGROUND: pointing hand and glowing interface, focus locked on the screen.
BACKGROUND: dark office depth with LED bokeh breathing softly.
WARDROBE TONAL BEHAVIOR: dark matte shirts drinking the screen light, no sheen.
MAKEUP SURFACE PHYSICS: real skin texture with cool specular kiss from the monitor, no retouching.
POST BEHAVIOR: Kodak Vision3 500T 5219, visible organic grain, halation blooming on screen highlights, lifted blacks.
COMPOSITIONAL GEOMETRY: screen weighted to right two-thirds, silhouettes framing left edge, layered depth.
MOOD & ART DIRECTION: Composition and art direction inspired in the work of award-winning directors.""".format(biz=biz)

    P["s5_final"] = """CAMERA: ARRI Alexa 35, ISO 800, low-angle position near the ground, tilted up toward the doorway.
LENS: Canon K35 24mm T1.5, three meters from subject, deep-breathing wide field with focus on the face.
LIGHT: golden hour sun at 3.200K backlighting through the glass door, flare licking the lens edge, warm bounce fill rising from the pavement.
SUBJECT: a smiling satisfied client stepping forward out of the glass door of {biz}, relaxed confident posture, one hand raised in a light wave.
FOREGROUND: warm flare and blurred pavement texture at the frame bottom.
MIDGROUND: the client mid-stride, focus on the smile.
BACKGROUND: glass facade reflecting warm sky, street depth dissolving into golden bokeh.
WARDROBE TONAL BEHAVIOR: light casual clothing catching rim light on the shoulders, soft matte fabric.
MAKEUP SURFACE PHYSICS: real skin texture with warm backlit glow on the jawline, no retouching.
POST BEHAVIOR: Kodak Vision3 250D 5207, visible organic grain, golden halation on the flare, rich warm midtones.
COMPOSITIONAL GEOMETRY: subject rising through center-right, door frame as natural vignette, sun flare entering top-left.
MOOD & ART DIRECTION: Composition and art direction inspired in the work of award-winning directors.""".format(biz=biz)

    if reel:
        P.pop("s4_tech")
    return P


def build_motion_prompts(reel=False):
    M = {
        "s1_hook": "Slow steady push-in toward the seated person, natural micro movements of the hands, lamp light flickers softly, dust motes drifting in the beam, shallow focus held on the eyes.",
        "s2_business": "Smooth lateral dolly to the right across the counter, the attendant gestures warmly, the client nods and smiles, pendant light bokeh drifting, natural daylight steady.",
        "s3_detail": "Slow arcing orbit around the work surface as the hands keep working precisely, surfaces catching moving speculars, calm confident pace, focus locked on the action.",
        "s4_tech": "Slow push toward the glowing screen as one professional points at the interface, screen glow pulsing subtly on both faces, the second person nods, LED bokeh breathing in the dark background.",
        "s5_final": "Camera rises gently from low angle as the smiling person steps forward out of the glass door, golden sun flare sweeping across the lens, door glass reflecting warm light.",
    }
    if reel:
        M.pop("s4_tech")
    return M
