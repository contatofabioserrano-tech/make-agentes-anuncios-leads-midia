"""Monta o vídeo UGC vertical (9:16) a partir dos clipes gerados, com legendas grandes em pt-BR e cartão final.

  python3 scripts/anuncios/build_ugc_video.py hyper-petg-preto clip1.mp4 "legenda 1|legenda 2" clip2.mp4 "legenda 3|legenda 4"
"""
import json
import os
import subprocess
import sys
import tempfile

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
FONT = os.path.join(ROOT, "worker", "pipeline_py", "fonts", "Poppins-Bold.ttf")
W, H = 1080, 1920


def caption_png(text, path, top=False):
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    f = ImageFont.truetype(FONT, 68)
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if d.textlength(t, font=f) > W - 160:
            lines.append(cur)
            cur = w
        else:
            cur = t
    lines.append(cur)
    y = 260 if top else H - 520 - 90 * (len(lines) - 1)
    for ln in lines:
        tw = d.textlength(ln, font=f)
        x = (W - tw) / 2
        d.rounded_rectangle((x - 28, y - 14, x + tw + 28, y + 86), 22, fill=(0, 0, 0, 170))
        d.text((x, y), ln, font=f, fill="white")
        y += 104
    im.save(path)


def end_card(path, title, sub, accent=(225, 28, 36)):
    im = Image.new("RGB", (W, H), (8, 11, 16))
    d = ImageDraw.Draw(im)
    f1, f2 = ImageFont.truetype(FONT, 92), ImageFont.truetype(FONT, 54)
    for k, (t, f, c) in enumerate([(title, f1, "white"), (sub, f2, accent)]):
        tw = d.textlength(t, font=f)
        d.text(((W - tw) / 2, 820 + k * 150), t, font=f, fill=c)
    im.save(path)


def main(slug, pairs):
    out_dir = os.path.join(ROOT, "public", "marketplace", slug, "tiktok", "ugc")
    with tempfile.TemporaryDirectory() as tmp:
        parts = []
        for i, (clip, caps) in enumerate(pairs):
            caps = caps.split("|")
            dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", clip]).decode().strip())
            half = dur / len(caps)
            pngs = []
            for k, c in enumerate(caps):
                p = os.path.join(tmp, f"c{i}_{k}.png")
                caption_png(c, p)
                pngs.append(p)
            inputs = ["-i", clip] + sum([["-i", p] for p in pngs], [])
            chain, last = f"[0:v]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},setsar=1,fps=30[v0]", "v0"
            for k in range(len(pngs)):
                chain += f";[{last}][{k + 1}:v]overlay=0:0:enable='between(t,{k * half:.2f},{(k + 1) * half:.2f})'[v{k + 1}]"
                last = f"v{k + 1}"
            seg = os.path.join(tmp, f"seg{i}.mp4")
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *inputs, "-filter_complex", chain, "-map", f"[{last}]", "-an",
                            "-c:v", "libx264", "-crf", "22", "-pix_fmt", "yuv420p", seg], check=True)
            parts.append(seg)
        card = os.path.join(tmp, "card.png")
        end_card(card, "Hyper PETG", "1,75 mm · 1 kg · até 600 mm/s")
        seg = os.path.join(tmp, "end.mp4")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-loop", "1", "-t", "2.2", "-i", card, "-r", "30", "-c:v", "libx264", "-pix_fmt", "yuv420p", seg], check=True)
        parts.append(seg)
        lst = os.path.join(tmp, "l.txt")
        open(lst, "w").write("".join(f"file '{p}'\n" for p in parts))
        out = os.path.join(out_dir, "ugc_video_9x16.mp4")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst, "-c:v", "libx264", "-crf", "24",
                        "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out], check=True)
    dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out]).decode().strip())
    mp = os.path.join(ROOT, "public", "marketplace", slug, "assets.json")
    meta = json.load(open(mp))
    meta["ugc/ugc_video_9x16.mp4"] = {"width": W, "height": H, "bytes": os.path.getsize(out), "durationSec": round(dur, 2)}
    json.dump(meta, open(mp, "w"), indent=1)
    print(out, round(dur, 1), "s", os.path.getsize(out) // 1024, "KB")


if __name__ == "__main__":
    a = sys.argv[1:]
    main(a[0], list(zip(a[1::2], a[2::2])))
