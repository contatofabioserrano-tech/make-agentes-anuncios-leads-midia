# -*- coding: utf-8 -*-
"""Montagem 'propaganda'/'google_ads' — port parametrizado dos assemble_spot2/assemble_spot3
PROVADOS: preprocess com watermark + padding XF, dissolves xfade com offsets por duração
REAL (ffprobe), endcard Pillow (primary escurecido ou claro pela luminância), legendas
queimadas com keywords na cor accent (BGR ASS, passada única com lambda), trilha
cinematográfica (booms 80bpm / sinos 68bpm), ducking sidechain com asplit, loudnorm,
master 4K. Paths RELATIVOS (cwd = workdir) — nunca C:\\ dentro de filtergraph."""
import re

from PIL import Image, ImageDraw

from fc_audio import cine_music
from fc_cards import font
from fc_common import (FF, darken, ffprobe_dur as dur, lighten, luminance,
                       rgb_to_ass, run)
from fc_propaganda import SCENE_ORDER

FPS = 30
ECD = 5.0  # duração do endcard
WHITE = (255, 255, 255)


def _ts(x):
    h = int(x // 3600)
    m = int(x % 3600 // 60)
    s = x % 60
    return "%d:%02d:%05.2f" % (h, m, s)


def build_endcard(colors, logo_path, cta, sub, W, H, out):
    """Endcard Pillow (padrão spot3): fundo derivado do primary — escurecido se a marca
    é escura, tint claro se a marca é clara (luminância) — logo + divisor accent +
    CTA do briefing + endereço. Retorna True se o card é claro (define fadewhite)."""
    prim, _, accent = colors
    light = luminance(prim) >= 150
    if light:
        bg = lighten(prim, 0.72)
        ink = darken(prim, 0.62)
        subcol = darken(accent, 0.25)
    else:
        bg = darken(prim, 0.38)
        ink = WHITE
        subcol = lighten(accent, 0.12)
    img = Image.new("RGB", (W, H), bg)
    d = ImageDraw.Draw(img)
    logo = Image.open(logo_path).convert("RGBA")
    lw = int(W * (0.5 if H > W else 0.24))
    lh = int(logo.height * lw / logo.width)
    logo = logo.resize((lw, lh), Image.LANCZOS)
    size = 58 if H > W else 52
    f_cta = font("Poppins-SemiBold.ttf", size)
    maxw = W - int(W * 0.12)
    while size > 30 and d.textlength(cta, font=f_cta) > maxw:
        size -= 4
        f_cta = font("Poppins-SemiBold.ttf", size)
    f_sub = font("Poppins-Medium.ttf", 44 if H > W else 38)
    gap1, bar_h, gap2, gap3 = 64, 6, 56, 34
    cta_h = int(f_cta.size * 1.25)
    sub_h = int(f_sub.size * 1.25) if sub else 0
    block = lh + gap1 + bar_h + gap2 + cta_h + ((gap3 + sub_h) if sub else 0)
    y = (H - block) // 2

    def center(yy, t, f, fill):
        w = d.textlength(t, font=f)
        d.text(((W - w) / 2, yy), t, font=f, fill=fill)

    img.paste(logo, ((W - lw) // 2, y), logo)
    y += lh + gap1
    d.rectangle([(W / 2 - 70, y), (W / 2 + 70, y + bar_h)], fill=accent)
    y += bar_h + gap2
    center(y, cta, f_cta, ink)
    if sub:
        center(y + cta_h + gap3, sub, f_sub, subcol)
    img.save(out)
    print("endcard ok (%s) -> %s" % ("claro" if light else "escuro", out), flush=True)
    return light


def assemble_spot(spec, copy, colors, out_path, W=1080, H=1920, mood="booms",
                  legendado=False, keywords=None):
    """6 cenas seedance + endcard: dissolves, legendas opcionais, trilha, VO, ducking."""
    brand = spec.get("brand") or {}
    br = spec.get("briefing") or {}
    XF = 0.5 if mood == "booms" else 0.6
    grade = ("eq=contrast=1.06:saturation=1.10,unsharp=5:5:0.35" if mood == "booms"
             else "eq=contrast=1.05:saturation=1.08:brightness=0.01,unsharp=5:5:0.3")
    cta = (re.sub(r"\s+", " ", (br.get("cta") or "").strip()) or "Fale com a gente").upper()
    sub = re.sub(r"\s+", " ", str(brand.get("address") or brand.get("tagline")
                                  or brand.get("name") or "")).strip()
    light = build_endcard(colors, "work/logo.png", cta, sub, W, H, "work/endcard.png")

    print("[1/6] preprocess cenas (watermark)", flush=True)
    lw = max(120, int(W * 0.14))
    for i, n in enumerate(SCENE_ORDER):
        src = "videos/%s.mp4" % n
        s = dur(src)
        target = min(s, 5.0) + XF
        fac = target / s
        run(FF + ["-i", src, "-i", "work/logo.png", "-filter_complex",
                  "[0:v]scale=%d:%d:force_original_aspect_ratio=increase,crop=%d:%d,"
                  "setpts=%.5f*PTS,fps=%d,%s[v0];"
                  "[1:v]scale=%d:-1,format=rgba,colorchannelmixer=aa=0.55[lg];"
                  "[v0][lg]overlay=W-w-42:48,format=yuv420p[v]"
                  % (W, H, W, H, fac, FPS, grade, lw),
                  "-map", "[v]", "-an", "-c:v", "libx264", "-crf", "17",
                  "work/p%d.mp4" % i])
    run(FF + ["-loop", "1", "-i", "work/endcard.png", "-t", "%.2f" % ECD, "-an",
              "-vf", "scale=%d:%d,fade=t=in:st=0:d=0.6,fade=t=out:st=%.2f:d=0.6,"
              "fps=%d,format=yuv420p" % (W, H, ECD - 0.6, FPS),
              "-c:v", "libx264", "-crf", "17", "work/p6.mp4"])

    print("[2/6] xfade dissolves (offsets por duração REAL)", flush=True)
    n = 7
    L = [dur("work/p%d.mp4" % i) for i in range(n)]
    starts = [0.0]
    for k in range(1, n):
        starts.append(starts[-1] + L[k - 1] - XF)
    trans = ["fade"] * 5 + ["fadewhite" if light else "fadeblack"]
    inp = []
    for i in range(n):
        inp += ["-i", "work/p%d.mp4" % i]
    chain = ""
    prev = "[0:v]"
    for k in range(1, n):
        chain += "%s[%d:v]xfade=transition=%s:duration=%.2f:offset=%.3f[x%d];" % (
            prev, k, trans[k - 1], XF, starts[k], k)
        prev = "[x%d]" % k
    run(FF + inp + ["-filter_complex", chain.rstrip(";"), "-map", prev,
                    "-c:v", "libx264", "-crf", "17", "-pix_fmt", "yuv420p",
                    "work/tl.mp4"])
    TOT = dur("work/tl.mp4")
    EC_T = starts[6]
    print("   total %.2fs | endcard %.2fs" % (TOT, EC_T), flush=True)

    vo_lines = copy["vo"]
    vd = [dur("vo/vo%d.mp3" % i) for i in range(1, 7)]
    vo_t = [starts[0] + 0.8, starts[1] + 0.5, starts[2] + 0.5,
            starts[3] + 0.5, starts[4] + 0.5, EC_T + 0.8]

    print("[3/6] %s" % ("legendas queimadas" if legendado else "sem legendas"), flush=True)
    video_txt = "work/tl.mp4"
    if legendado:
        accent_ass = rgb_to_ass(colors[2])
        kws = [k for k in (keywords or []) if k]
        pat = None
        if kws:
            pat = re.compile(r"(?i)\b(%s)\b" % "|".join(
                re.escape(k) for k in sorted(kws, key=len, reverse=True)))
        events = []
        for i, line in enumerate(vo_lines):
            a = max(0.0, vo_t[i] - 0.1)
            b = min(TOT - 0.05, vo_t[i] + vd[i] + 0.5)
            line = line.replace("{", "(").replace("}", ")")
            if pat:
                # passada única + lambda: evita o gotcha do \1 virar backreference
                line = pat.sub(lambda m: "{\\1c%s}%s{\\1c&HFFFFFF&}"
                               % (accent_ass, m.group(0)), line)
            events.append("Dialogue: 0,%s,%s,Cap,,0,0,0,,{\\fad(120,120)}%s"
                          % (_ts(a), _ts(b), line))
        fs = 62 if H > W else 52
        mv = int(H * 0.115)
        ass = (
            "[Script Info]\nScriptType: v4.00+\nPlayResX: %d\nPlayResY: %d\n"
            "WrapStyle: 2\nScaledBorderAndShadow: yes\n\n"
            "[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, "
            "SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, "
            "StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, "
            "Alignment, MarginL, MarginR, MarginV, Encoding\n"
            "Style: Cap,Poppins,%d,&H00FFFFFF,&H000000FF,&H00000000,&H8C000000,"
            "0,0,0,0,100,100,1,0,1,4,2,2,90,90,%d,1\n\n"
            "[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, "
            "MarginV, Effect, Text\n" % (W, H, fs, mv) + "\n".join(events) + "\n")
        with open("work/caps.ass", "w", encoding="utf-8") as fh:
            fh.write(ass)
        run(FF + ["-i", "work/tl.mp4", "-vf", "subtitles=work/caps.ass:fontsdir=fonts",
                  "-an", "-c:v", "libx264", "-crf", "17", "-pix_fmt", "yuv420p",
                  "work/tl_txt.mp4"])
        video_txt = "work/tl_txt.mp4"

    print("[4/6] trilha cinematográfica (%s)" % mood, flush=True)
    cine_music(TOT, starts[1:], EC_T, "work/music.wav", mood)

    print("[5/6] mix VO + ducking", flush=True)
    if mood == "booms":
        mus_vol, thr, ratio, att, rel = 0.75, 0.025, 4.0, 25, 500
        ln = "loudnorm=I=-14:TP=-1.2:LRA=11"
    else:
        mus_vol, thr, ratio, att, rel = 0.8, 0.03, 3.5, 30, 600
        ln = "loudnorm=I=-15:TP=-1.3:LRA=11"
    inputs = ["-i", video_txt]
    for i in range(1, 7):
        inputs += ["-i", "vo/vo%d.mp3" % i]
    inputs += ["-i", "work/music.wav"]
    fc = ""
    for k in range(1, 7):
        ms = int(vo_t[k - 1] * 1000)
        fc += "[%d:a]adelay=%d|%d,apad=whole_dur=%.2f[v%d];" % (k, ms, ms, TOT, k)
    fc += "".join("[v%d]" % k for k in range(1, 7))
    fc += "amix=inputs=6:duration=longest:normalize=0,volume=2.0,asplit=2[voA][voB];"
    fc += "[7:a]volume=%.2f,atrim=0:%.2f[mus];" % (mus_vol, TOT)
    fc += ("[mus][voA]sidechaincompress=threshold=%.3f:ratio=%.1f:attack=%d:release=%d"
           "[msc];" % (thr, ratio, att, rel))
    fc += "[voB][msc]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.93,%s[a]" % ln
    run(FF + inputs + ["-filter_complex", fc, "-map", "0:v", "-map", "[a]",
                       "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
                       "-shortest", "-movflags", "+faststart", out_path])
    print("[6/6] OK %.2fs -> %s" % (dur(out_path), out_path), flush=True)
    return TOT, EC_T


def master_4k(src, dst, W4, H4):
    """Master 4K por upscale lanczos + unsharp (padrão spot2/spot3)."""
    run(FF + ["-i", src, "-vf", "scale=%d:%d:flags=lanczos,unsharp=5:5:0.3" % (W4, H4),
              "-c:v", "libx264", "-crf", "17", "-preset", "slow", "-c:a", "copy",
              "-movflags", "+faststart", dst])
    print("4K ok -> %s" % dst, flush=True)
