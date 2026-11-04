"""Comercial TikTok "uso real" — Creality Hyper PETG Preto.

Monta, a partir das fontes versionadas em kits/.../fontes/:
  cena1_impressao.mp4   bico imprimindo rápido (gancho)
  cena2_unboxing.mp4    mãos abrindo o vácuo e colocando o rolo na impressora
  cena3_peca.mp4        peça saindo da mesa
  cena4_teste.mp4       teste de força (gancho na parede segurando mochila)
  voz_gabriel_take1.mp3 locução ElevenLabs (voz brasileira, influência carioca)
  trilha.mp3            trilha ElevenLabs Music (sem voz)

Saídas (raw/video/v2, fora do git): comercial_feed_1080.mp4 (com CTA) e comercial_produto_1080.mp4.
Depois rode build_tiktok_assets.py para publicar no portal e gerar o vídeo de <= 5 MB.

Áudio "de comercial":
  voz   -> passa-alta 80 Hz, corte de embolado em 250 Hz, presença +3 dB em 3 kHz, brilho em 9 kHz,
           compressor 3:1, de-esser leve
  trilha-> buraco de -4 dB em 2,5 kHz (espaço para a voz) + ducking por sidechain da voz
  sfx   -> whoosh em cada corte
  final -> loudnorm -14 LUFS / -1 dBTP (padrão TikTok/Reels)
"""
import os
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
KIT = os.path.join(ROOT, "kits", "58-creality-hyper-petg-preto")
SRC = os.path.join(KIT, "fontes")
WORK = os.path.join(KIT, "raw", "video", "v2")
FONTS = os.path.join(ROOT, "worker", "pipeline_py", "fonts")
GALLERY = os.path.join(ROOT, "public", "marketplace", "hyper-petg-preto", "tiktok")
W, H, FPS = 1080, 1920, 30

# Linha do tempo amarrada aos tempos das palavras da locução (transcrição whisper do take 1).
#  (arquivo, início no clipe, duração na timeline)
TIMELINE = [
    ("cena1_impressao.mp4", 0.2, 4.60),   # "Olha a velocidade dessa impressora, 600 mm/s" (recorte: tira letreiro falso do topo)
    ("cena2_unboxing.mp4", 0.0, 5.45),    # "Mas e o filamento, aguenta? Esse aqui aguenta, Creality Hyper PETG"
    ("cena3_peca.mp4", 1.6, 1.20),        # "camada firme"
    ("cena4_teste.mp4", 0.4, 2.10),       # "peça resistente, pronta pra usar"
    ("@vacuo", 0.0, 2.40),                # "rolo de 1 kg, embalado a vácuo"  (foto real do produto embalado)
    ("@card", 0.0, 2.25),                 # "Toca no carrinho e garante o teu!" (trilha termina ~17,5 s)
]

# Recorte por cena (zoom para tirar algo do quadro): (largura, altura, x, y) no quadro 1080x1920.
CROP = {"cena1_impressao.mp4": (864, 1536, 108, 384)}

# Legendas no estilo TikTok: (início, fim, texto). {Y}=amarelo (palavra-chave).
CAPTIONS = [
    (0.00, 1.10, "OLHA A VELOCIDADE"), (1.10, 2.15, "DESSA IMPRESSORA"),
    (2.15, 4.55, "{Y}600 MM/S"),
    (4.65, 6.05, "MAS E O FILAMENTO,"), (6.05, 6.80, "{Y}AGUENTA?"),
    (6.80, 8.15, "ESSE AQUI AGUENTA"), (8.15, 10.05, "{Y}CREALITY HYPER PETG"),
    (10.20, 11.20, "CAMADA FIRME"), (11.20, 12.30, "{Y}PEÇA RESISTENTE"),
    (12.30, 13.35, "PRONTA PRA USAR"),
    (13.40, 14.60, "ROLO DE{Y}  1\\hKG"), (14.60, 15.75, "EMBALADO A{Y} VÁCUO"),
]


def run(cmd):
    subprocess.run(cmd, check=True)


def font(name, size):
    return ImageFont.truetype(os.path.join(FONTS, name), size)


def still_vacuo(out):
    """Foto do rolo embalado, em 9:16 sobre branco puro (a foto já tem fundo branco)."""
    im = Image.open(os.path.join(GALLERY, "07_embalagem_vacuo.jpg")).convert("RGB")
    bg = Image.new("RGB", (W, H), (255, 255, 255))  # mesmo branco da foto: sem "caixa" aparente
    fg = im.resize((1040, 1040), Image.LANCZOS)
    bg.paste(fg, ((W - 1040) // 2, 360))
    bg.save(out)


def end_card(out, mode):
    bg = Image.new("RGB", (W, H), (12, 12, 14))
    d = ImageDraw.Draw(bg)
    for y in range(H):
        t = y / H
        d.line([(0, y), (W, y)], fill=(int(12 + 26 * t), int(12 + 12 * t), int(14 + 4 * t)))
    bg = bg.convert("RGBA")
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse((120, 560, 960, 1400), fill=(255, 106, 0, 120))
    bg.alpha_composite(glow.filter(ImageFilter.GaussianBlur(150)))
    p = Image.open(os.path.join(SRC, "creality_oficial_petg_preto.png")).convert("RGBA")
    p = p.crop(p.getbbox())
    r = 800 / p.height
    p = p.resize((int(p.width * r), 800), Image.LANCZOS)
    bg.alpha_composite(p, ((W - p.width) // 2, 540))
    d = ImageDraw.Draw(bg)

    def c(txt, y, f, fill):
        d.text(((W - d.textlength(txt, font=f)) / 2, y), txt, font=f, fill=fill)

    c("CREALITY", 200, font("Poppins-SemiBold.ttf", 44), (255, 140, 40))
    c("Hyper PETG", 255, font("Poppins-Bold.ttf", 124), (255, 255, 255))
    chips = ["1 kg", "1,75 mm", "até 600 mm/s"]
    f = font("Poppins-SemiBold.ttf", 40)
    widths = [d.textlength(x, font=f) + 56 for x in chips]
    x = (W - (sum(widths) + 24 * (len(chips) - 1))) / 2
    for txt, w in zip(chips, widths):
        d.rounded_rectangle((x, 430, x + w, 494), radius=32, outline=(255, 255, 255, 160), width=3)
        d.text((x + 28, 438), txt, font=f, fill=(235, 235, 235))
        x += w + 24
    if mode == "feed":
        d.rounded_rectangle((150, 1420, 930, 1570), radius=75, fill=(254, 44, 85))
        cart = font("Poppins-Bold.ttf", 60)
        c("🛒" if False else "TOCA NO CARRINHO", 1462, cart, (255, 255, 255))
        c("e garante o teu", 1600, font("Poppins-Medium.ttf", 44), (230, 230, 230))
    else:
        f2 = font("Poppins-SemiBold.ttf", 42)
        c("Bico 220–260 °C  •  Mesa 60–80 °C", 1440, f2, (255, 255, 255))
        c("Ventoinha 50%  •  Embalado a vácuo", 1510, f2, (255, 255, 255))
    bg.convert("RGB").save(out)


def captions_ass(out, until):
    def at(t):
        return f"{int(t // 3600)}:{int(t % 3600 // 60):02d}:{t % 60:05.2f}"
    head = ("[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\nWrapStyle: 0\n[V4+ Styles]\n"
            "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, "
            "Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
            "Style: Cap,Poppins,100,&H00FFFFFF,&H000000FF,&H00101010,&H78000000,-1,0,0,0,100,100,3,0,1,9,4,2,90,140,560,1\n"
            "[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n")
    ev = []
    for st, en, txt in CAPTIONS:
        if st >= until:
            continue
        txt = txt.replace("{Y}", "{\\c&H00D4FF&}")
        # "pop" de entrada: escala 85% -> 100% em 90 ms
        ev.append(f"Dialogue: 0,{at(st)},{at(min(en, until))},Cap,,0,0,0,,"
                  f"{{\\fscx85\\fscy85\\t(0,90,\\fscx100\\fscy100)}}{txt}")
    open(out, "w").write(head + "\n".join(ev) + "\n")


def whoosh_track(cuts, total, out):
    sys.path.insert(0, os.path.join(ROOT, "worker", "pipeline_py"))
    import fc_audio
    # write_sfx espera o início de cada segmento (o 1º é 0) e o tipo de transição; o whoosh entra 0,14 s antes do corte
    fc_audio.write_sfx([0.0] + cuts, ["slide"] * len(cuts), total, out)


def build(mode):
    os.makedirs(WORK, exist_ok=True)
    vacuo, card = os.path.join(WORK, "vacuo.png"), os.path.join(WORK, f"card_{mode}.png")
    still_vacuo(vacuo)
    end_card(card, mode)
    total = round(sum(d for _, _, d in TIMELINE), 2)
    cta_at = total - TIMELINE[-1][2]
    caps = os.path.join(WORK, "caps.ass")
    captions_ass(caps, cta_at)

    inputs, chains, labels = [], [], []
    grade = "eq=contrast=1.06:saturation=1.10:gamma=0.98,unsharp=5:5:0.6"
    for i, (src, start, dur) in enumerate(TIMELINE):
        lab = f"v{i}"
        if src == "@vacuo":
            inputs += ["-framerate", str(FPS), "-loop", "1", "-t", f"{dur}", "-i", vacuo]
            chains.append(f"[{i}:v]zoompan=z='1.0+0.0012*on':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s={W}x{H}:fps={FPS},setsar=1,format=yuv420p[{lab}]")
        elif src == "@card":
            inputs += ["-framerate", str(FPS), "-loop", "1", "-t", f"{dur}", "-i", card]
            chains.append(f"[{i}:v]zoompan=z='min(1.0+0.0008*on,1.05)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s={W}x{H}:fps={FPS},setsar=1,format=yuv420p[{lab}]")
        else:
            path = os.path.join(SRC, src)
            clip_len = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                                            capture_output=True, text=True).stdout)
            avail = clip_len - start
            speed = min(1.0, avail / dur)  # se o clipe for curto, desacelera um pouco em vez de congelar
            inputs += ["-i", path]
            crop = ""
            if src in CROP:
                cw, ch, cx, cy = CROP[src]
                crop = f"crop={cw}:{ch}:{cx}:{cy},scale={W}:{H}:flags=lanczos,"
            chains.append(f"[{i}:v]trim=start={start},setpts=(PTS-STARTPTS)/{speed:.4f},fps={FPS},"
                          f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},{crop}{grade},"
                          f"trim=duration={dur},setpts=PTS-STARTPTS,setsar=1,format=yuv420p[{lab}]")
        labels.append(f"[{lab}]")

    n = len(TIMELINE)
    voice, music = os.path.join(SRC, "voz_gabriel_take1.mp3"), os.path.join(SRC, "trilha.mp3")
    cuts, t = [], 0.0
    for _, _, d in TIMELINE[:-1]:
        t += d
        cuts.append(round(t, 2))
    sfx = os.path.join(WORK, "sfx.wav")
    whoosh_track(cuts, total, sfx)
    inputs += ["-i", voice, "-i", music, "-i", sfx]
    vi, mi, si = n, n + 1, n + 2
    fc = ";".join(chains) + ";" + "".join(labels) + f"concat=n={n}:v=1:a=0[vc];[vc]subtitles={caps}:fontsdir={FONTS}[v];"
    fc += (
        f"[{vi}:a]aresample=48000,highpass=f=80,equalizer=f=250:t=q:w=1.2:g=-3,equalizer=f=3000:t=q:w=1.4:g=3,"
        f"equalizer=f=9000:t=q:w=1.0:g=1.5,deesser=i=0.3,acompressor=threshold=-20dB:ratio=3:attack=5:release=90:makeup=3,"
        f"adelay=60|60,apad=whole_dur={total},asplit=2[vox][vkey];"
        f"[{mi}:a]aresample=48000,atrim=0:{total},equalizer=f=2500:t=q:w=1.2:g=-4,volume=0.55,"
        f"afade=t=out:st={total - 0.8}:d=0.8[mus];"
        f"[mus][vkey]sidechaincompress=threshold=0.04:ratio=5:attack=15:release=250[duck];"
        f"[{si}:a]aresample=48000,volume=0.45[sfx];"
        f"[duck][vox][sfx]amix=inputs=3:duration=first:normalize=0,alimiter=limit=0.95,"
        f"loudnorm=I=-14:TP=-1:LRA=7[a]"
    )
    out = os.path.join(WORK, f"comercial_{mode}_1080.mp4")
    run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", fc, "-map", "[v]", "-map", "[a]",
         "-t", str(total), "-r", str(FPS), "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", out])
    print(mode, "->", out, f"{total}s")
    return out


if __name__ == "__main__":
    for m in ("feed", "produto"):
        build(m)
