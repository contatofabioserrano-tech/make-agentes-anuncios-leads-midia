# -*- coding: utf-8 -*-
"""Cards de marca (Pillow) — card CTA, painéis de sweep e lower-third, adaptados do
prep_assets.py/prep_v2.py PROVADOS, com cores/logo/contatos vindos do spec.brand."""
import os
import shutil
import urllib.request

from PIL import Image, ImageDraw, ImageFont

from fc_common import FONTS_SRC, LOGO_DEFAULT

W, H = 1080, 1920
WHITE = (255, 255, 255)
LIGHT = (232, 234, 230)


def font(name, size):
    return ImageFont.truetype(os.path.join(FONTS_SRC, name), size)


def _fit(d, text, fname, size, maxw, minsize=36):
    f = font(fname, size)
    while size > minsize and d.textlength(text, font=f) > maxw:
        size -= 4
        f = font(fname, size)
    return f


def center(d, y, t, f, fill):
    w = d.textlength(t, font=f)
    d.text(((W - w) / 2, y), t, font=f, fill=fill)


def fetch_logo(url, dest):
    """Baixa o logo da marca (URL do Storage); fallback: logo_default.png."""
    ok = False
    if url and str(url).lower().startswith("http"):
        try:
            urllib.request.urlretrieve(url, dest)
            Image.open(dest).verify()
            ok = True
            print("[logo] baixado de spec.brand.logo_path", flush=True)
        except Exception as e:
            print("[logo] download falhou (%s) — usando logo padrão" % str(e)[:100], flush=True)
    if not ok:
        shutil.copyfile(LOGO_DEFAULT, dest)
    return dest


def load_logo(path):
    return Image.open(path).convert("RGBA")


def cta_card(colors, logo, l1, l2, contacts, tagline, out):
    prim, prim_med, accent = colors
    img = Image.new("RGB", (W, H), prim)
    d = ImageDraw.Draw(img)
    lg = logo.resize((300, 300), Image.LANCZOS)
    img.paste(lg, ((W - 300) // 2, 300), lg)
    if l1:
        center(d, 760, l1, _fit(d, l1, "Poppins-Bold.ttf", 100, W - 120), WHITE)
    if l2:
        center(d, 880, l2, _fit(d, l2, "Poppins-Bold.ttf", 100, W - 120), accent)
    d.rectangle([(W / 2 - 80, 1050), (W / 2 + 80, 1058)], fill=accent)
    y = 1120
    styles = [("Poppins-SemiBold.ttf", 56, WHITE), ("Poppins-Medium.ttf", 46, LIGHT),
              ("Poppins-Medium.ttf", 32, LIGHT)]
    for i, line in enumerate(contacts[:3]):
        fname, size, fill = styles[i]
        center(d, y, line, _fit(d, line, fname, size, W - 100), fill)
        y += 90 if i == 0 else 80
    if tagline:
        d.rectangle([(0, 1720), (W, 1860)], fill=prim_med)
        center(d, 1758, tagline, _fit(d, tagline, "Poppins-SemiBold.ttf", 44, W - 100), WHITE)
    img.save(out)
    print(os.path.basename(out), "ok", flush=True)


def panel(bg, word, sub, out, logo, wordcolor=WHITE):
    img = Image.new("RGB", (W, H), bg)
    d = ImageDraw.Draw(img)
    lg = logo.resize((340, 340), Image.LANCZOS)
    img.paste(lg, ((W - 340) // 2, 600), lg)
    if word:
        f = _fit(d, word, "Poppins-Bold.ttf", 96, W - 100)
        center(d, 1040, word, f, wordcolor)
    if sub:
        f2 = _fit(d, sub, "Poppins-Medium.ttf", 44, W - 120)
        center(d, 1180, sub, f2, WHITE)
    img.save(out)
    print(os.path.basename(out), "ok", flush=True)


def lower_third(address, sub, prim, accent, out):
    line1, line2 = address, sub
    if "," in address:
        parts = address.split(",")
        line1 = ",".join(parts[:-1]).strip()
        tail = parts[-1].strip()
        line2 = (tail + (" · " + sub if sub else "")) if tail else sub
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rectangle([(0, 1620), (W, 1760)], fill=prim + (235,))
    d.rectangle([(0, 1620), (14, 1760)], fill=accent + (255,))
    d.text((50, 1650), line1, font=_fit(d, line1, "Poppins-SemiBold.ttf", 44, W - 110), fill=WHITE)
    if line2:
        d.text((50, 1706), line2, font=_fit(d, line2, "Poppins-Medium.ttf", 36, W - 110), fill=LIGHT)
    img.save(out)
    print(os.path.basename(out), "ok", flush=True)
