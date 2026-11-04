# -*- coding: utf-8 -*-
"""Fortuna Creative — motor de render (Python).

Uso: python run_pipeline.py --spec spec.json --workdir <dir>

spec.json: { videoType: 'propaganda'|'google_ads'|'reel'|'carrossel'|'integra',
             aspect, legendado,
             brand: { name, colors:{primary,accent}, logo_path, phone, whatsapp,
                      address, tagline },
             briefing: { objetivo, oferta, cta, tom, observacoes },
             source_video_path }  # 'integra': o worker baixa a fonte pra source.mp4

Saídas em out/:
  propaganda  -> final_9x16.mp4 (1080x1920) + final_4k.mp4 (2160x3840)
                 [+ final_16x9.mp4 blur-pad se aspect incluir '16:9']
  google_ads  -> final_16x9.mp4 (1920x1080 NATIVO) + final_4k.mp4 (3840x2160)
  reel        -> final_9x16.mp4 [+ final_16x9.mp4 se aspect incluir '16:9']
  carrossel   -> slide_01.png .. slide_10.png (1080x1350)
  integra     -> final_9x16.mp4 [+ final_16x9.mp4 se aspect incluir '16:9']
('comercial30' legado = alias de 'propaganda'.)

Protocolo com o worker (stdout): "STAGE <nome>" e "PROGRESS <n>"; em erro,
stderr recebe "PIPELINE_ERROR stage=<nome>: <msg>" e exit code 1.
"""
import argparse
import json
import os
import shutil
import sys

from fc_common import (FONTS_SRC, current_stage, hex_to_rgb, lighten, progress, stage)
from fc_prompts import build_copy, build_motion_prompts, build_scene_prompts, xai_refine
from fc_higgsfield import gen_images, gen_videos, gen_videos_seedance
from fc_audio import tts
from fc_cards import cta_card, fetch_logo, load_logo, lower_third, panel
from fc_captions import transcribe_ass
from fc_assemble import (INTEGRA_OPEN, assemble_generative, assemble_integra, export_16x9)
from fc_propaganda import (REAL_SCENE, REAL_SCENE_MOTION, build_spot_copy,
                           build_spot_scenes, caption_keywords,
                           pick_voice_and_mood, prepare_real_scene)
from fc_spot_assemble import assemble_spot, master_4k
from fc_carrossel import build_slide_prompts, build_slides, compose_slides

VALID_TYPES = ("propaganda", "google_ads", "reel", "carrossel", "integra", "comercial30")


def _colors(spec):
    brand = spec.get("brand") or {}
    c = brand.get("colors") or {}
    prim = hex_to_rgb(c.get("primary"), (15, 61, 46))
    accent = hex_to_rgb(c.get("accent"), (255, 122, 0))
    return prim, lighten(prim, 0.28), accent


def _contacts(brand):
    out = []
    if brand.get("whatsapp"):
        out.append("WhatsApp %s" % brand["whatsapp"])
    if brand.get("phone"):
        out.append(str(brand["phone"]))
    if brand.get("address"):
        out.append(str(brand["address"]))
    return out


def build_visual_assets(spec, copy, colors, video_type):
    """Cards/painéis Pillow dos modos legados (reel/integra)."""
    brand = spec.get("brand") or {}
    prim, prim_med, accent = colors
    logo = load_logo("work/logo.png")
    cta_card(colors, logo, copy["cta_l1"], copy["cta_l2"], _contacts(brand),
             brand.get("tagline") or brand.get("name") or "", "work/cta.png")
    panel(prim, "", "", "work/panel_open.png", logo)
    if video_type == "reel":
        panel(accent, copy["panel1_word"], copy["panel1_sub"], "work/panel_1.png", logo)
        if brand.get("address"):
            lower_third(str(brand["address"]), brand.get("name") or "", prim, accent,
                        "work/lower.png")


def run_spot(spec, colors, aspects, legendado, landscape):
    """'propaganda' (9:16) / 'google_ads' (16:9 nativo) — pipeline spot2/spot3."""
    W, H = (1920, 1080) if landscape else (1080, 1920)

    stage("roteiro")
    copy = build_spot_copy(spec)
    with open("work/copy.json", "w", encoding="utf-8") as f:
        json.dump(copy, f, ensure_ascii=False, indent=2)
    progress(8)

    stage("imagens")
    prompts, motions = build_spot_scenes(spec)
    # Foto real da marca (brand.photos[0]) vira a CENA 3 no lugar da gerada:
    # canvas fit+blur do reference + motion sutil que preserva o rosto. A VO 3
    # continua a mesma. Se o download falhar, segue com a cena gerada.
    real_scene = prepare_real_scene(
        spec, os.path.join("images", REAL_SCENE + ".png"), landscape=landscape)
    if real_scene:
        prompts = {k: v for k, v in prompts.items() if k != REAL_SCENE}
        motions = dict(motions)
        motions[REAL_SCENE] = REAL_SCENE_MOTION
    with open("work/prompts.json", "w", encoding="utf-8") as f:
        json.dump({"scenes": prompts, "motions": motions,
                   "real_scene": bool(real_scene)}, f, ensure_ascii=False, indent=2)
    gen_images(prompts, "images", aspect=("16:9" if landscape else "9:16"),
               resolution="4k")
    progress(35)

    stage("videos")
    gen_videos_seedance(motions, "images", "videos")
    progress(60)

    stage("locucao")
    voice, edge_voice, mood, settings = pick_voice_and_mood(spec)
    lines = {"vo%d" % i: t for i, t in enumerate(copy["vo"], 1)}
    engine = tts(lines, "vo", voice=voice, edge_voice=edge_voice, settings=settings)
    print("[tts] engine: %s | voz: %s | mood: %s" % (engine, voice, mood), flush=True)
    progress(70)

    stage("montagem")
    main_name = "final_16x9.mp4" if landscape else "final_9x16.mp4"
    main_out = os.path.join("out", main_name)
    assemble_spot(spec, copy, colors, main_out, W=W, H=H, mood=mood,
                  legendado=legendado, keywords=caption_keywords(spec))
    progress(88)

    stage("export")
    master_4k(main_out, os.path.join("out", "final_4k.mp4"),
              3840 if landscape else 2160, 2160 if landscape else 3840)
    if not landscape and "16:9" in aspects:
        export_16x9(main_out, os.path.join("out", "final_16x9.mp4"))
    progress(97)
    print("DONE out/%s" % main_name, flush=True)


def run_carrossel(spec, colors):
    """'carrossel' — 10 artes 4:5 (1080x1350) em out/slide_01..10.png."""
    stage("roteiro")
    slides = build_slides(spec)
    with open("work/slides.json", "w", encoding="utf-8") as f:
        json.dump({"slides": slides}, f, ensure_ascii=False, indent=2)
    progress(10)

    stage("imagens")
    prompts = build_slide_prompts(spec)
    with open("work/prompts.json", "w", encoding="utf-8") as f:
        json.dump(prompts, f, ensure_ascii=False, indent=2)
    gen_images(prompts, "images", aspect="4:5", resolution="2k")
    progress(65)

    stage("artes")
    compose_slides(slides, colors, "work/logo.png", "images", "out")
    progress(97)
    print("DONE out/slide_01.png..slide_%02d.png" % len(slides), flush=True)


def run_reel(spec, colors, aspects):
    """'reel' — fluxo curto existente (kling + painéis + kinetic + VO + trilha)."""
    stage("roteiro")
    copy = build_copy(spec, "reel")
    copy = xai_refine(copy, spec)
    with open("work/copy.json", "w", encoding="utf-8") as f:
        json.dump(copy, f, ensure_ascii=False, indent=2)
    progress(10)

    prompts = build_scene_prompts(spec, True)
    motions = build_motion_prompts(True)
    with open("work/prompts.json", "w", encoding="utf-8") as f:
        json.dump({"scenes": prompts, "motions": motions}, f, ensure_ascii=False, indent=2)

    stage("imagens")
    gen_images(prompts, "images2", aspect="9:16", resolution="2k")
    progress(30)

    stage("videos")
    gen_videos(motions, "images2", "videos")
    progress(55)

    stage("locucao")
    engine = tts({k: copy["vo"][k] for k in copy["vo_order"]}, "vo")
    print("[tts] engine: %s" % engine, flush=True)

    stage("assets")
    build_visual_assets(spec, copy, colors, "reel")
    progress(75)

    stage("montagem")
    final9 = os.path.join("out", "final_9x16.mp4")
    assemble_generative(copy, colors[2], final9, reel=True)
    progress(90)

    stage("export")
    if "16:9" in aspects:
        export_16x9(final9, os.path.join("out", "final_16x9.mp4"))
    progress(95)
    print("DONE out/final_9x16.mp4", flush=True)


def run_integra(spec, colors, aspects):
    """'integra' — painel de marca + vídeo-fonte + card CTA (fluxo existente)."""
    if not os.path.exists("source.mp4"):
        raise RuntimeError("source.mp4 ausente — worker não baixou source_video_path "
                           "do bucket 'videos'")

    stage("roteiro")
    copy = build_copy(spec, "integra")
    copy = xai_refine(copy, spec)
    with open("work/copy.json", "w", encoding="utf-8") as f:
        json.dump(copy, f, ensure_ascii=False, indent=2)
    progress(10)

    stage("assets")
    build_visual_assets(spec, copy, colors, "integra")
    progress(30)

    stage("transcricao")
    ass_path = transcribe_ass("source.mp4", "work/caps.ass", offset=INTEGRA_OPEN)
    progress(55)

    stage("montagem")
    final9 = os.path.join("out", "final_9x16.mp4")
    assemble_integra(final9, ass_path=ass_path)
    progress(90)

    stage("export")
    if "16:9" in aspects:
        export_16x9(final9, os.path.join("out", "final_16x9.mp4"))
    progress(95)
    print("DONE out/final_9x16.mp4", flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--spec", required=True)
    ap.add_argument("--workdir", required=True)
    a = ap.parse_args()

    with open(a.spec, encoding="utf-8") as f:
        spec = json.load(f)
    workdir = os.path.abspath(a.workdir)
    os.chdir(workdir)  # tudo RELATIVO a partir daqui (gotcha ffmpeg filtergraph)

    video_type = (spec.get("videoType") or "propaganda").strip()
    if video_type not in VALID_TYPES:
        raise RuntimeError("videoType desconhecido: %r (esperado %s)"
                           % (video_type, "/".join(VALID_TYPES)))
    if video_type == "comercial30":  # legado → pipeline aprovado
        video_type = "propaganda"
    aspects = str(spec.get("aspect")
                  or ("16:9" if video_type == "google_ads" else "9:16"))
    legendado = bool(spec.get("legendado"))

    stage("setup")
    for d in ("work", "vo", "out", "images", "images2", "videos"):
        os.makedirs(d, exist_ok=True)
    shutil.copytree(FONTS_SRC, "fonts", dirs_exist_ok=True)  # fontsdir relativo
    fetch_logo((spec.get("brand") or {}).get("logo_path"), "work/logo.png")
    colors = _colors(spec)

    if video_type in ("propaganda", "google_ads"):
        run_spot(spec, colors, aspects, legendado, landscape=(video_type == "google_ads"))
    elif video_type == "carrossel":
        run_carrossel(spec, colors)
    elif video_type == "reel":
        run_reel(spec, colors, aspects)
    else:
        run_integra(spec, colors, aspects)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        sys.stderr.write("PIPELINE_ERROR stage=%s: %s\n" % (current_stage(), str(e)[:800]))
        sys.exit(1)
