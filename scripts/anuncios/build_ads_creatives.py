"""Gera os criativos de campanha (Meta, Google, OpenAI Ads) a partir das imagens do kit,
nos formatos 1:1, 4:5, 9:16 e 1,91:1, e grava as medidas em assets.json da pasta ads/.

  python3 scripts/anuncios/build_ads_creatives.py hyper-petg-preto

Regra: recorta pelo centro quando perde até 20% da imagem; se perderia mais, encaixa a imagem
inteira sobre um fundo (branco para foto de fundo branco, desfocado para foto de cena) — assim o
produto nunca sai cortado.
"""
import json
import os
import sys

from PIL import Image, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
FORMATS = {"1x1": (1080, 1080), "4x5": (1080, 1350), "9x16": (1080, 1920), "191x1": (1200, 628)}
SOURCES = {"principal": "01_principal.jpg", "uso": "02_uso_impressora.jpg", "pecas": "03_pecas_funcionais.jpg",
           "ugc_maker": "ugc/u1_maker_segurando.jpg", "ugc_resultado": "ugc/u3_resultado_pecas.jpg"}
# UGC já nasce no formato certo: usa a própria imagem quando a proporção bate
NATIVE = {("ugc_maker", "4x5"): "ugc/u7_ads_4x5.jpg", ("ugc_maker", "9x16"): "ugc/u8_creator_9x16.jpg"}


def white_bg(im):
    w, h = im.size
    px = [im.getpixel((x, y)) for x in (0, w - 1) for y in range(0, h, max(1, h // 20))]
    return sum(1 for p in px if min(p[:3]) >= 245) / len(px) > 0.9


def fit(im, size):
    tw, th = size
    sw, sh = im.size
    scale_cover = max(tw / sw, th / sh)
    lost = 1 - (tw * th) / (sw * scale_cover * sh * scale_cover)
    if lost <= 0.20:
        nw, nh = round(sw * scale_cover), round(sh * scale_cover)
        r = im.resize((nw, nh), Image.LANCZOS)
        x, y = (nw - tw) // 2, (nh - th) // 2
        return r.crop((x, y, x + tw, y + th)), "recorte"
    if white_bg(im):
        bg = Image.new("RGB", size, (255, 255, 255))
    else:
        bw, bh = round(sw * scale_cover), round(sh * scale_cover)
        bg = im.resize((bw, bh), Image.LANCZOS).filter(ImageFilter.GaussianBlur(40))
        bx, by = (bw - tw) // 2, (bh - th) // 2
        bg = bg.crop((bx, by, bx + tw, by + th))
    s = min(tw / sw, th / sh) * 0.94
    r = im.resize((round(sw * s), round(sh * s)), Image.LANCZOS)
    bg.paste(r, ((tw - r.width) // 2, (th - r.height) // 2))
    return bg, "encaixe"


def cutout(im, side=1200):
    """Remove o fundo branco ligado às bordas (flood fill), suaviza a borda e corta no produto."""
    from PIL import ImageDraw, ImageChops
    im = im.copy()
    im.thumbnail((side, side), Image.LANCZOS)
    w, h = im.size
    mask_src = im.copy()
    for xy in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]:
        ImageDraw.floodfill(mask_src, xy, (255, 0, 255), thresh=18)
    r, g, b = mask_src.split()
    bgmask = ImageChops.multiply(ImageChops.multiply(r.point(lambda v: 255 if v == 255 else 0), g.point(lambda v: 255 if v == 0 else 0)), b.point(lambda v: 255 if v == 255 else 0))
    alpha = ImageChops.invert(bgmask).filter(ImageFilter.GaussianBlur(1.2))
    out = im.convert("RGBA")
    out.putalpha(alpha)
    bbox = alpha.point(lambda v: 255 if v > 20 else 0).getbbox()
    return out.crop(bbox) if bbox else out


def main(slug):
    src_dir = os.path.join(ROOT, "public", "marketplace", slug, "tiktok")
    out_dir = os.path.join(ROOT, "public", "marketplace", slug, "ads")
    os.makedirs(out_dir, exist_ok=True)
    meta = {}
    for name, f in SOURCES.items():
        if not os.path.exists(os.path.join(src_dir, f)):
            continue
        im = Image.open(os.path.join(src_dir, f)).convert("RGB")
        for fk, size in FORMATS.items():
            nat = NATIVE.get((name, fk))
            out, how = fit(Image.open(os.path.join(src_dir, nat)).convert("RGB") if nat else im, size)
            fn = f"{name}_{fk}.jpg"
            path = os.path.join(out_dir, fn)
            out.save(path, "JPEG", quality=88, optimize=True, progressive=True)
            meta[fn] = {"width": out.width, "height": out.height, "bytes": os.path.getsize(path), "modo": how, "origem": f}
            print(f"{fn}: {out.width}×{out.height} ({how})")
    # recorte do produto (fundo branco -> transparente) para a landing page escura
    im = Image.open(os.path.join(src_dir, SOURCES["principal"])).convert("RGB")
    if white_bg(im):
        cut = cutout(im)
        cut.save(os.path.join(out_dir, "produto_recorte.png"), optimize=True)
        meta["produto_recorte.png"] = {"width": cut.width, "height": cut.height, "bytes": os.path.getsize(os.path.join(out_dir, "produto_recorte.png")), "modo": "recorte-fundo", "origem": SOURCES["principal"]}
        print(f"produto_recorte.png: {cut.width}×{cut.height}")
    json.dump(meta, open(os.path.join(out_dir, "assets.json"), "w"), indent=1, ensure_ascii=False)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "hyper-petg-preto")
