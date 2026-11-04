"""Monta os arquivos do anúncio TikTok Shop e mede cada um.

Uso:  python3 scripts/anuncios/build_tiktok_assets.py hyper-petg-preto

- Converte as fontes (kits/...) para JPEG quadrado no padrão do TikTok Shop
  (1:1, >= 600 px; principal com fundo branco puro).
- Gera o vídeo do produto (<= 5 MB) a partir do vídeo final do feed.
- Escreve public/marketplace/<slug>/assets.json com as MEDIÇÕES REAIS
  (largura, altura, bytes, % de borda branca, índice de cor, duração),
  que o validador (lib/marketplace/tiktok.ts) usa para aprovar o anúncio.
"""
import json
import os
import subprocess
import sys

from PIL import Image
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

SOURCES = {
    "hyper-petg-preto": {
        "kit": "kits/58-creality-hyper-petg-preto",
        "images": {
            # destino            : (fonte relativa ao kit, lado em px)
            "01_principal.jpg": ("01_principal_fundo_branco_ML_Amazon.jpg", 1600),
            "02_uso_impressora.jpg": ("02_lifestyle_impressora.jpg", 1200),
            "03_pecas_funcionais.jpg": ("04_aplicacoes_pecas.jpg", 1200),
            "04_detalhe_filamento.jpg": ("fontes/ia_detalhe_filamento.jpg", 1200),
            "05_escala_mao.jpg": ("fontes/ia_escala_mao.jpg", 1200),
            "06_lateral.jpg": ("fontes/ia_lateral.jpg", 1200),
            "07_embalagem_vacuo.jpg": ("fontes/ia_embalagem_vacuo.jpg", 1200),
            "d1_configuracoes_impressao.jpg": ("08_ficha_impressao_PT.jpg", 1200),
            "d2_destaques.jpg": ("03_infografico_PT.jpg", 1200),
        },
        # vídeo do feed (com CTA) -> copiado; vídeo do produto -> re-encode <= 5 MB
        "feed_video": "raw/video/v2/comercial_feed_1080.mp4",
        "product_video": "raw/video/v2/comercial_produto_1080.mp4",
    }
}

VIDEO_MAX = 5 * 1024 * 1024


def measure_image(path):
    im = Image.open(path).convert("RGB")
    a = np.asarray(im).astype(np.int16)
    h, w, _ = a.shape
    b = max(2, int(min(w, h) * 0.02))
    border = np.concatenate([a[:b].reshape(-1, 3), a[-b:].reshape(-1, 3),
                             a[:, :b].reshape(-1, 3), a[:, -b:].reshape(-1, 3)])
    white = float((border.min(axis=1) >= 250).mean())
    # índice de cor medido só nos pixels do produto (fora do fundo branco),
    # senão um produto pequeno em fundo branco pareceria "preto e branco".
    diff = (np.abs(a[..., 0] - a[..., 1]) + np.abs(a[..., 1] - a[..., 2])) / 2
    fg = a.min(axis=2) < 245
    colorfulness = float(diff[fg].mean()) if fg.any() else 0.0
    return {"width": w, "height": h, "bytes": os.path.getsize(path),
            "whiteBorderRatio": round(white, 4), "colorfulness": round(colorfulness, 2)}


def probe(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0",
                          "-show_entries", "stream=width,height:format=duration",
                          "-of", "json", path], capture_output=True, text=True, check=True)
    j = json.loads(out.stdout)
    s = j["streams"][0]
    return {"width": s["width"], "height": s["height"], "bytes": os.path.getsize(path),
            "durationSec": round(float(j["format"]["duration"]), 2)}


def square(src, dst, side):
    im = Image.open(src).convert("RGB")
    if im.width != im.height:  # centraliza em quadrado branco, sem cortar o produto
        s = max(im.size)
        c = Image.new("RGB", (s, s), (255, 255, 255))
        c.paste(im, ((s - im.width) // 2, (s - im.height) // 2))
        im = c
    im = im.resize((side, side), Image.LANCZOS)
    im.save(dst, quality=90, optimize=True, progressive=True)


def product_video(src, dst):
    """Re-encode até caber em 5 MB (o limite do TikTok Shop para o vídeo do anúncio)."""
    for crf in (26, 28, 30, 32, 34):
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-vf", "scale=720:1280",
                        "-c:v", "libx264", "-preset", "slow", "-crf", str(crf), "-pix_fmt", "yuv420p",
                        "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", dst], check=True)
        if os.path.getsize(dst) <= VIDEO_MAX * 0.95:
            return crf
    raise SystemExit(f"vídeo do produto ainda acima de 5 MB: {os.path.getsize(dst)} bytes")


def main(slug):
    cfg = SOURCES[slug]
    kit = os.path.join(ROOT, cfg["kit"])
    out = os.path.join(ROOT, "public", "marketplace", slug, "tiktok")
    os.makedirs(out, exist_ok=True)
    meta = {}
    for dst, (src, side) in cfg["images"].items():
        p = os.path.join(out, dst)
        square(os.path.join(kit, src), p, side)
        meta[dst] = measure_image(p)
        print(f"{dst:34s} {meta[dst]}")

    # imagens de dúvidas (FAQ) para a descrição: desenhadas por código a partir das imagens acima
    sys.path.insert(0, os.path.dirname(__file__))
    import build_faq_cards
    build_faq_cards.main()
    for name in sorted(os.listdir(out)):
        if name.startswith("faq") and name.endswith(".jpg"):
            meta[name] = measure_image(os.path.join(out, name))
            print(f"{name:34s} {meta[name]}")

    feed_src = os.path.join(kit, cfg["feed_video"])
    if os.path.exists(feed_src):
        feed_dst = os.path.join(out, "video_feed_9x16.mp4")
        subprocess.run(["cp", feed_src, feed_dst], check=True)
        meta["video_feed_9x16.mp4"] = probe(feed_dst)
        pv = os.path.join(out, "video_produto.mp4")
        crf = product_video(os.path.join(kit, cfg["product_video"]), pv)
        meta["video_produto.mp4"] = probe(pv)
        print("video_produto.mp4", meta["video_produto.mp4"], "crf", crf)
    else:
        print("AVISO: rode antes  python3 scripts/anuncios/build_reel.py  (vídeo não encontrado):", feed_src)

    with open(os.path.join(ROOT, "public", "marketplace", slug, "assets.json"), "w") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)
    print("assets.json OK")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "hyper-petg-preto")
