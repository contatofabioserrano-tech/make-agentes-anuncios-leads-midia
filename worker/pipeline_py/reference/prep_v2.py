# -*- coding: utf-8 -*-
"""PROVADO: locucao edge-tts pt-BR + paineis de marca (sweeps Nubank) + lower-third de endereco."""
import asyncio, os
import edge_tts
from PIL import Image, ImageDraw, ImageFont

W,H=1080,1920
GREEN=(15,61,46); GREEN_MED=(46,125,90); ORANGE=(255,122,0); WHITE=(255,255,255)
F=lambda n,s: ImageFont.truetype("fonts/"+n,s)
logo=Image.open("work/logo.png").convert("RGBA")
os.makedirs("vo",exist_ok=True)

LINES = {
 "vo1":"Seu pet precisa de cuidado especializado?",
 "vo2":"Conheça a Doutor Jund Pet, em Jundiaí.",
 "vo3":"Um hospital veterinário completo, pronto pra receber quem você ama.",
 "vo4":"Especialista em animais silvestres e exóticos.",
 "vo5":"Medicina de ponta, com atendimento 24 horas.",
 "vo6":"Seu melhor amigo, em boas mãos.",
 "vo7":"Agende sua consulta. Doutor Jund Pet. Medicina de ponta. Amor que fica.",
}
async def tts():
    for k,txt in LINES.items():
        c=edge_tts.Communicate(txt, "pt-BR-FranciscaNeural", rate="-4%")
        await c.save(f"vo/{k}.mp3")
        print(k,"ok")
asyncio.run(tts())

def panel(bg, word, sub, fname, wordcolor=WHITE):
    img=Image.new("RGB",(W,H),bg); d=ImageDraw.Draw(img)
    lg=logo.resize((340,340),Image.LANCZOS); img.paste(lg,((W-340)//2,600),lg)
    if word:
        f=F("Poppins-Bold.ttf",96)
        wpx=d.textlength(word,font=f); d.text(((W-wpx)/2,1040),word,font=f,fill=wordcolor)
    if sub:
        f2=F("Poppins-Medium.ttf",44)
        wpx=d.textlength(sub,font=f2); d.text(((W-wpx)/2,1180),sub,font=f2,fill=WHITE)
    img.save(f"work/{fname}"); print(fname,"ok")

panel(GREEN, "", "", "panel_open.png")
panel(ORANGE, "SILVESTRES", "e exóticos · especialista de verdade", "panel_silvestres.png")
panel(GREEN, "24 HORAS", "todos os dias · emergência sempre aberta", "panel_24h.png", wordcolor=ORANGE)

img=Image.new("RGBA",(W,H),(0,0,0,0)); d=ImageDraw.Draw(img)
d.rectangle([(0,1620),(W,1760)],fill=(15,61,46,235))
d.rectangle([(0,1620),(14,1760)],fill=ORANGE+(255,))
f=F("Poppins-SemiBold.ttf",44)
d.text((50,1650),"Rua Bom Jesus de Pirapora, 2654",font=f,fill=WHITE)
f2=F("Poppins-Medium.ttf",36)
d.text((50,1706),"Vila Rami · Jundiaí/SP",font=f2,fill=(225,228,222))
img.save("work/lower_endereco.png"); print("lower_endereco ok")
