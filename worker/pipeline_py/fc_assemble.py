# -*- coding: utf-8 -*-
"""Montagem final — adaptação parametrizada do assemble2.py PROVADO:
sweeps xfade com padding do overlap, kinetic ASS estável (\\move+\\fad, sem zoompan/noise),
VO com ducking sidechain, trilha sob medida, loudnorm -14. Tudo com paths RELATIVOS
(cwd = workdir) — nunca caminho absoluto dentro de filtergraph."""
import os

from fc_common import FF, clamp, ffprobe_dims, ffprobe_dur as dur, has_audio, rgb_to_ass, run
from fc_audio import build_music, write_sfx

W, H, FPS, XF = 1080, 1920, 30, 0.30


def _ts(x):
    h = int(x // 3600)
    m = int(x % 3600 // 60)
    s = x % 60
    return "%d:%02d:%05.2f" % (h, m, s)


def _preprocess(segs):
    """Renderiza cada segmento com duração d + XF (padding do overlap do xfade)."""
    n = len(segs)
    for i, seg in enumerate(segs):
        typ, src, dd = seg[0], seg[1], seg[2]
        out = "work/m%d.mp4" % i
        Li = dd + (XF if i < n - 1 else 0.0)
        if typ == "panel":
            vf = "scale=%d:%d,format=yuv420p" % (W, H)
            if i == 0:
                vf += ",fade=t=in:st=0:d=0.35"
            if i == n - 1:
                vf += ",fade=t=out:st=%.2f:d=0.5" % (Li - 0.5)
            run(FF + ["-loop", "1", "-i", src, "-t", "%.3f" % Li, "-an", "-vf", vf,
                      "-r", str(FPS), "-c:v", "libx264", "-crf", "18", out])
        else:  # clip gerado (kling) — estica levemente com setpts pra cobrir Li
            s = dur(src)
            fac = Li / s
            run(FF + ["-i", src, "-an", "-vf",
                      "scale=%d:%d:force_original_aspect_ratio=increase,crop=%d:%d,"
                      "setpts=%.5f*PTS,fps=%d,eq=contrast=1.05:saturation=1.08,format=yuv420p"
                      % (W, H, W, H, fac, FPS),
                      "-c:v", "libx264", "-crf", "18", out])


def _xfade(segs, trans, out="work/tl.mp4"):
    n = len(segs)
    L = [segs[i][2] + (XF if i < n - 1 else 0.0) for i in range(n)]
    starts = [0.0]
    for k in range(1, n):
        starts.append(starts[-1] + L[k - 1] - XF)
    inp = []
    for i in range(n):
        inp += ["-i", "work/m%d.mp4" % i]
    chain = ""
    prev = "[0:v]"
    for k in range(1, n):
        lab = "[x%d]" % k
        chain += "%s[%d:v]xfade=transition=%s:duration=%.2f:offset=%.3f%s;" % (
            prev, k, trans[k - 1], XF, starts[k], lab)
        prev = lab
    chain = chain.rstrip(";")
    run(FF + inp + ["-filter_complex", chain, "-map", prev,
                    "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", out])
    return starts, dur(out)


def _kinetic_ass(events, path="work/kin.ass"):
    """events = [(a, b, texto_ass_pronto)] — estilo idêntico ao PROVADO."""
    mv = "{\\an5\\move(540,1526,540,1508,0,320)\\fad(180,150)}"
    lines = ["Dialogue: 0,%s,%s,Kin,,0,0,0,,%s%s" % (_ts(a), _ts(b), mv, t) for a, b, t in events]
    ass = (
        "[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\n"
        "WrapStyle: 2\nScaledBorderAndShadow: yes\n\n"
        "[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, "
        "OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, "
        "Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
        "Style: Kin,Poppins SemiBold,74,&H00FFFFFF,&H000000FF,&H00000000,&H96000000,"
        "1,0,0,0,100,100,1,0,1,5,3,5,60,60,60,1\n\n"
        "[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
        + "\n".join(lines) + "\n"
    )
    with open(path, "w", encoding="utf-8") as f:
        f.write(ass)
    return path


def _burn(video_in, out, ass_path=None, lower_png=None, lower_window=None):
    """Lower-third (overlay com enable) + subtitles ASS. fontsdir RELATIVO (gotcha)."""
    if lower_png and lower_window:
        fa, fb = lower_window
        fcx = "[0:v][1:v]overlay=0:0:enable='between(t,%.2f,%.2f)'[bg];" % (fa, fb)
        fcx += ("[bg]subtitles=%s:fontsdir=fonts[v]" % ass_path) if ass_path else "[bg]null[v]"
        run(FF + ["-i", video_in, "-i", lower_png, "-filter_complex", fcx, "-map", "[v]",
                  "-an", "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", out])
    elif ass_path:
        run(FF + ["-i", video_in, "-vf", "subtitles=%s:fontsdir=fonts" % ass_path,
                  "-an", "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", out])
    else:
        run(FF + ["-i", video_in, "-an", "-c:v", "copy", out])


def _accentify(text, accent_ass):
    return text.replace("[[", "{\\1c%s}" % accent_ass).replace("]]", "{\\1c&HFFFFFF&}")


def assemble_generative(copy, accent_rgb, out_path, reel=False):
    """comercial30 = estrutura completa; reel = ~20-28s sem a cena tech e holds menores."""
    vo_keys = copy["vo_order"]
    vd = {k: dur("vo/%s.mp3" % k) for k in vo_keys}
    print("VO durs:", {k: round(v, 2) for k, v in vd.items()}, flush=True)
    kin = copy.get("kin") or {}

    if not reel:
        d1 = clamp(vd["vo1"] + 0.9, 4.0, 5.2)
        d2 = clamp(vd["vo3"] + 0.9, 4.2, 5.8)
        d3 = clamp(vd["vo4"] + 0.9, 4.0, 5.2)
        d4 = clamp(vd["vo5"] + 0.9, 4.0, 5.2)
        d5 = clamp(vd["vo6"] + 0.9, 4.0, 5.2)
        dC = vd["vo7"] + 1.5
        # (tipo, src, dur, vo_key, kin_text)
        segs = [
            ("panel", "work/panel_open.png", 1.25, None, None),
            ("clip", "videos/s1_hook.mp4", d1, "vo1", kin.get("s1_hook")),
            ("panel", "work/panel_open.png", 0.85, "vo2", None),
            ("clip", "videos/s2_business.mp4", d2, "vo3", kin.get("s2_business")),
            ("panel", "work/panel_1.png", 0.95, None, None),
            ("clip", "videos/s3_detail.mp4", d3, "vo4", kin.get("s3_detail")),
            ("panel", "work/panel_2.png", 0.95, None, None),
            ("clip", "videos/s4_tech.mp4", d4, "vo5", kin.get("s4_tech")),
            ("clip", "videos/s5_final.mp4", d5, "vo6", kin.get("s5_final")),
            ("panel", "work/cta.png", dC, "vo7", None),
        ]
    else:
        d1 = clamp(vd["vo1"] + 0.7, 3.2, 4.4)
        d2 = clamp(vd["vo2"] + 0.7, 3.0, 4.2)
        d3 = clamp(vd["vo3"] + 0.7, 3.2, 4.4)
        d5 = clamp(vd["vo6"] + 0.7, 3.0, 4.2)
        dC = vd["vo7"] + 1.2
        segs = [
            ("panel", "work/panel_open.png", 0.9, None, None),
            ("clip", "videos/s1_hook.mp4", d1, "vo1", kin.get("s1_hook")),
            ("clip", "videos/s2_business.mp4", d2, "vo2", kin.get("s2_business")),
            ("panel", "work/panel_1.png", 0.85, None, None),
            ("clip", "videos/s3_detail.mp4", d3, "vo3", kin.get("s3_detail")),
            ("clip", "videos/s5_final.mp4", d5, "vo6", kin.get("s5_final")),
            ("panel", "work/cta.png", dC, "vo7", None),
        ]

    n = len(segs)
    trans = ["slideleft"] * (n - 1)
    if n >= 6:
        trans[2] = "smoothleft"
    if n >= 3:
        trans[n - 3] = "fade"
    trans[n - 2] = "slideup"

    print("[1/6] preprocess (sem zoompan/noise = sem tremido)", flush=True)
    _preprocess(segs)

    print("[2/6] xfade sweeps", flush=True)
    starts, TOT = _xfade(segs, trans)
    CTA_T = starts[n - 1]
    print("   total: %.2fs | CTA em %.2fs" % (TOT, CTA_T), flush=True)

    print("[3/6] kinetic type + lower-third", flush=True)
    accent_ass = rgb_to_ass(accent_rgb)
    events = []
    for i, seg in enumerate(segs):
        if seg[4]:
            a = starts[i] + 0.50
            b = starts[i] + seg[2] - 0.35
            events.append((a, b, _accentify(seg[4], accent_ass)))
    ass_path = _kinetic_ass(events) if events else None
    lower_idx = next((i for i, s in enumerate(segs) if "s2_business" in s[1]), None)
    lower_window = None
    lower_png = None
    if lower_idx is not None and os.path.exists("work/lower.png"):
        lower_png = "work/lower.png"
        lower_window = (starts[lower_idx] + 0.45, starts[lower_idx] + segs[lower_idx][2] - 0.30)
    _burn("work/tl.mp4", "work/final_v.mp4", ass_path, lower_png, lower_window)

    print("[4/6] trilha sob medida", flush=True)
    build_music(TOT, CTA_T, "work/music.wav")

    print("[5/6] SFX whoosh nos sweeps", flush=True)
    write_sfx(starts, trans, TOT, "work/sfx.wav")

    print("[6/6] mix final: VO + trilha (duck) + sfx", flush=True)
    vo_starts = {}
    for i, seg in enumerate(segs):
        if seg[3]:
            vo_starts[seg[3]] = starts[i] + (0.55 if seg[3] == vo_keys[-1] else 0.35)
    inputs = ["-i", "work/final_v.mp4"]
    for k in vo_keys:
        inputs += ["-i", "vo/%s.mp3" % k]
    inputs += ["-i", "work/music.wav", "-i", "work/sfx.wav"]
    N = len(vo_keys)
    fc = ""
    for j, k in enumerate(vo_keys, start=1):
        ms = int(vo_starts[k] * 1000)
        fc += "[%d:a]adelay=%d|%d,apad=whole_dur=%.2f[v%d];" % (j, ms, ms, TOT, j)
    fc += "".join("[v%d]" % j for j in range(1, N + 1))
    fc += "amix=inputs=%d:duration=longest:normalize=0,volume=1.9,asplit=2[voA][voB];" % N
    mi, si = N + 1, N + 2
    fc += "[%d:a]volume=0.62,atrim=0:%.2f[mus];" % (mi, TOT)
    fc += "[mus][voA]sidechaincompress=threshold=0.02:ratio=7:attack=12:release=420[msc];"
    fc += "[%d:a]volume=0.95,apad[sx];" % si
    fc += "[voB][msc][sx]amix=inputs=3:duration=first:normalize=0,alimiter=limit=0.93,loudnorm=I=-14:TP=-1.2:LRA=11[a]"
    run(FF + inputs + ["-filter_complex", fc, "-map", "0:v", "-map", "[a]",
                       "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
                       "-shortest", "-movflags", "+faststart", out_path])
    print("OK %.2fs -> %s" % (dur(out_path), out_path), flush=True)
    return TOT, CTA_T


INTEGRA_OPEN = 1.2  # duração do painel de abertura do modo 'integra' (offset das legendas)


def assemble_integra(out_path, ass_path=None):
    """Modo 'integra': painel de marca + vídeo-fonte (narração no comando) + card CTA.
    Trilha discreta duckada pela narração; legendas se a transcrição existir."""
    sdur = dur("source.mp4")
    sw, sh = ffprobe_dims("source.mp4")
    portrait = sh >= sw
    dC = 4.5
    segs = [("panel", "work/panel_open.png", INTEGRA_OPEN),
            ("source", "source.mp4", sdur),
            ("panel", "work/cta.png", dC)]
    n = 3
    trans = ["fade", "slideup"]

    print("[1/5] preprocess fonte (%dx%d, %s)" % (sw, sh, "retrato" if portrait else "paisagem"), flush=True)
    run(FF + ["-loop", "1", "-i", "work/panel_open.png", "-t", "%.3f" % (INTEGRA_OPEN + XF),
              "-an", "-vf", "scale=%d:%d,format=yuv420p,fade=t=in:st=0:d=0.35" % (W, H),
              "-r", str(FPS), "-c:v", "libx264", "-crf", "18", "work/m0.mp4"])
    if portrait:
        vf = ("scale=%d:%d:force_original_aspect_ratio=increase,crop=%d:%d,fps=%d,"
              "tpad=stop_mode=clone:stop_duration=%.2f,format=yuv420p" % (W, H, W, H, FPS, XF))
        run(FF + ["-i", "source.mp4", "-an", "-vf", vf,
                  "-c:v", "libx264", "-crf", "18", "work/m1.mp4"])
    else:
        # blur-pad: fundo desfocado + fonte inteira por cima (split/boxblur/overlay)
        fcx = ("[0:v]split=2[bg0][fg0];"
               "[bg0]scale=%d:%d:force_original_aspect_ratio=increase,crop=%d:%d,boxblur=24:2[bg];"
               "[fg0]scale=%d:-2[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,fps=%d,"
               "tpad=stop_mode=clone:stop_duration=%.2f,format=yuv420p[v]"
               % (W, H, W, H, W, FPS, XF))
        run(FF + ["-i", "source.mp4", "-filter_complex", fcx, "-map", "[v]", "-an",
                  "-c:v", "libx264", "-crf", "18", "work/m1.mp4"])
    LC = dC
    run(FF + ["-loop", "1", "-i", "work/cta.png", "-t", "%.3f" % LC, "-an",
              "-vf", "scale=%d:%d,format=yuv420p,fade=t=out:st=%.2f:d=0.5" % (W, H, LC - 0.5),
              "-r", str(FPS), "-c:v", "libx264", "-crf", "18", "work/m2.mp4"])

    print("[2/5] xfade", flush=True)
    starts, TOT = _xfade(segs, trans)
    CTA_T = starts[n - 1]
    print("   total: %.2fs | fonte em %.2fs | CTA em %.2fs" % (TOT, starts[1], CTA_T), flush=True)

    print("[3/5] legendas", flush=True)
    _burn("work/tl.mp4", "work/final_v.mp4", ass_path)

    print("[4/5] trilha discreta", flush=True)
    build_music(TOT, CTA_T, "work/music.wav")

    print("[5/5] mix: narração + trilha duckada", flush=True)
    if has_audio("source.mp4"):
        delay = int(starts[1] * 1000)
        fc = ("[1:a]adelay=%d|%d,apad=whole_dur=%.2f,asplit=2[voA][voB];"
              "[2:a]volume=0.35,atrim=0:%.2f[mus];"
              "[mus][voA]sidechaincompress=threshold=0.02:ratio=8:attack=10:release=400[msc];"
              "[voB][msc]amix=inputs=2:duration=first:normalize=0,"
              "alimiter=limit=0.93,loudnorm=I=-14:TP=-1.2:LRA=11[a]"
              % (delay, delay, TOT, TOT))
        run(FF + ["-i", "work/final_v.mp4", "-i", "source.mp4", "-i", "work/music.wav",
                  "-filter_complex", fc, "-map", "0:v", "-map", "[a]",
                  "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
                  "-shortest", "-movflags", "+faststart", out_path])
    else:
        print("   fonte sem áudio — trilha direta", flush=True)
        fade_out = min(2.5, TOT / 3)
        fc = ("[1:a]volume=0.55,atrim=0:%.2f,afade=t=out:st=%.2f:d=%.2f,"
              "loudnorm=I=-14:TP=-1.2:LRA=11[a]" % (TOT, TOT - fade_out, fade_out))
        run(FF + ["-i", "work/final_v.mp4", "-i", "work/music.wav",
                  "-filter_complex", fc, "-map", "0:v", "-map", "[a]",
                  "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
                  "-shortest", "-movflags", "+faststart", out_path])
    print("OK %.2fs -> %s" % (dur(out_path), out_path), flush=True)
    return TOT, CTA_T


def export_16x9(src, dst):
    """9:16 -> 16:9 por blur-pad (split/boxblur/overlay)."""
    fcx = ("[0:v]split=2[bg0][fg0];"
           "[bg0]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,boxblur=24:2[bg];"
           "[fg0]scale=-2:1080[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,format=yuv420p[v]")
    run(FF + ["-i", src, "-filter_complex", fcx, "-map", "[v]", "-map", "0:a?",
              "-c:v", "libx264", "-crf", "18", "-c:a", "copy",
              "-movflags", "+faststart", dst])
    print("16:9 ok -> %s" % dst, flush=True)
