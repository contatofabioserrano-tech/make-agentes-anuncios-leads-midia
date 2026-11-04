"""Imagens de "dúvidas frequentes" (FAQ) para a DESCRIÇÃO do anúncio TikTok Shop.

A política do TikTok Shop proíbe texto nas imagens da galeria, mas permite na descrição
imagens com guias, detalhes e instruções de uso. Estas imagens são desenhadas por código
(sem IA) para o texto sair 100% correto. Todo dado vem do Odoo ou do rótulo oficial.

Uso: python3 scripts/anuncios/build_faq_cards.py
"""
import os

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
KIT = os.path.join(ROOT, "kits", "58-creality-hyper-petg-preto")
OUT = os.path.join(ROOT, "public", "marketplace", "hyper-petg-preto", "tiktok")
FONTS = os.path.join(ROOT, "worker", "pipeline_py", "fonts")
S = 1200
INK, MUTED, ORANGE, SOFT = (22, 22, 28), (95, 95, 110), (255, 106, 0), (255, 243, 235)


def f(name, size):
    return ImageFont.truetype(os.path.join(FONTS, name), size)


def product(path, h):
    p = Image.open(path).convert("RGBA")
    if p.getbbox():
        p = p.crop(p.getbbox())
    r = h / p.height
    return p.resize((int(p.width * r), h), Image.LANCZOS)


def wrap(d, text, font, width):
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = f"{cur} {w}".strip()
        if d.textlength(t, font=font) <= width:
            cur = t
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def card(num, question, answer, bullets, img_path, img_h, out_name, photo=False,
         footer="Creality Hyper PETG • 1,75 mm • 1 kg", out_dir=None):
    im = Image.new("RGB", (S, S), "white")
    d = ImageDraw.Draw(im)
    # cabeçalho
    d.rounded_rectangle((70, 70, 70 + 230, 70 + 54), radius=27, fill=SOFT)
    d.text((92, 78), f"DÚVIDA {num}", font=f("Poppins-Bold.ttf", 30), fill=ORANGE)
    y = 150
    for line in wrap(d, question, f("Poppins-Bold.ttf", 64), 1060):
        d.text((70, y), line, font=f("Poppins-Bold.ttf", 64), fill=INK)
        y += 78
    y += 6
    for line in wrap(d, answer, f("Poppins-SemiBold.ttf", 38), 1060):
        d.text((70, y), line, font=f("Poppins-SemiBold.ttf", 38), fill=ORANGE)
        y += 50
    y += 24
    text_w = 600
    by = y
    for b in bullets:
        d.ellipse((74, by + 16, 92, by + 34), fill=ORANGE)
        lines = wrap(d, b, f("Poppins-Medium.ttf", 34), text_w)
        for k, line in enumerate(lines):
            d.text((112, by + k * 46), line, font=f("Poppins-Medium.ttf", 34), fill=INK)
        by += 46 * len(lines) + 22
    # produto / foto à direita
    p = product(img_path, img_h)
    if photo:
        p = Image.open(img_path).convert("RGB").resize((img_h, img_h), Image.LANCZOS).convert("RGBA")
        mask = Image.new("L", p.size, 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, *p.size), radius=36, fill=255)
        p.putalpha(mask)
    px, py = S - p.width - 60, S - p.height - 70
    im.paste(p, (px, py), p)
    # rodapé
    d.line((70, S - 60, S - 70, S - 60), fill=(235, 235, 240), width=2)
    d.text((70, S - 50), footer, font=f("Poppins-Medium.ttf", 26), fill=MUTED)
    im.save(os.path.join(out_dir or OUT, out_name), quality=90, optimize=True)
    print(out_name)


def main():
    spool = os.path.join(KIT, "fontes", "creality_oficial_petg_preto.png")
    card(1, "Funciona na minha impressora?",
         "Sim, se ela usa filamento de 1,75 mm.",
         ["Para impressoras 3D FDM com bico de 1,75 mm",
          "Feito para impressoras rápidas: até 600 mm/s",
          "Também imprime em velocidade normal, a partir de 30 mm/s"],
         spool, 620, "faq1_compatibilidade.jpg")
    card(2, "PETG ou PLA: qual escolher?",
         "Para peça que vai fazer força, PETG.",
         ["PETG: mais resistente a impacto e menos quebradiço",
          "PETG: aguenta mais calor que o PLA",
          "Ideal para suportes, engrenagens, caixas e peças de uso"],
         os.path.join(OUT, "03_pecas_funcionais.jpg"), 520, "faq2_petg_ou_pla.jpg", photo=True)
    card(3, "Como guardar o filamento?",
         "PETG absorve umidade do ar: guarde bem fechado.",
         ["Chega embalado a vácuo com sílica gel",
          "Depois de aberto, guarde em saco vedado com sílica",
          "Longe da luz do sol e de lugar úmido"],
         os.path.join(OUT, "04_detalhe_filamento.jpg"), 520, "faq3_armazenamento.jpg", photo=True)
    card(4, "O que vem na embalagem?",
         "1 rolo de 1 kg, pronto para usar.",
         ["Filamento PETG Creality Hyper Series, cor preta",
          "Diâmetro 1,75 mm, tolerância ± 0,03 mm",
          "Embalagem a vácuo com sílica gel"],
         os.path.join(OUT, "07_embalagem_vacuo.jpg"), 520, "faq4_embalagem.jpg", photo=True)


if __name__ == "__main__":
    main()
