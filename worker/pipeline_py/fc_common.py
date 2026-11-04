# -*- coding: utf-8 -*-
"""Helpers compartilhados do pipeline: paths, cores, ffmpeg/ffprobe, progresso."""
import os
import subprocess

PIPE_DIR = os.path.dirname(os.path.abspath(__file__))
FONTS_SRC = os.path.join(PIPE_DIR, "fonts")
LOGO_DEFAULT = os.path.join(PIPE_DIR, "logo_default.png")
MUSIC_DIR = os.path.normpath(os.path.join(PIPE_DIR, "..", "assets", "music"))

FF = ["ffmpeg", "-hide_banner", "-v", "error", "-y"]

_CURRENT_STAGE = "setup"


def run(cmd, **kw):
    subprocess.run(cmd, check=True, **kw)


def ffprobe_dur(path):
    return float(subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "csv=p=0", path]).strip())


def ffprobe_dims(path):
    out = subprocess.check_output(
        ["ffprobe", "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=width,height", "-of", "csv=p=0", path]
    ).decode("utf-8", errors="replace").strip()
    parts = out.split(",")
    return int(parts[0]), int(parts[1])


def has_audio(path):
    out = subprocess.check_output(
        ["ffprobe", "-v", "error", "-select_streams", "a",
         "-show_entries", "stream=index", "-of", "csv=p=0", path]
    ).decode("utf-8", errors="replace").strip()
    return bool(out)


def clamp(x, a, b):
    return max(a, min(b, x))


def hex_to_rgb(hx, fallback):
    try:
        hx = (hx or "").strip().lstrip("#")
        if len(hx) == 3:
            hx = "".join(c * 2 for c in hx)
        if len(hx) != 6:
            return fallback
        return tuple(int(hx[i:i + 2], 16) for i in (0, 2, 4))
    except Exception:
        return fallback


def lighten(rgb, f=0.28):
    return tuple(min(255, int(c + (255 - c) * f)) for c in rgb)


def darken(rgb, f=0.35):
    return tuple(max(0, int(c * (1.0 - f))) for c in rgb)


def luminance(rgb):
    r, g, b = rgb
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def rgb_to_ass(rgb):
    # ASS usa BGR: &HBBGGRR& (gotcha do README de referência)
    r, g, b = rgb
    return "&H%02X%02X%02X&" % (b, g, r)


def progress(n):
    print("PROGRESS %d" % n, flush=True)


def stage(name):
    global _CURRENT_STAGE
    _CURRENT_STAGE = name
    print("STAGE %s" % name, flush=True)


def current_stage():
    return _CURRENT_STAGE
