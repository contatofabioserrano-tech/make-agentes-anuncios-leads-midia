# -*- coding: utf-8 -*-
"""PROVADO: card CTA (Pillow) + trilha upbeat sintetizada (numpy). Args: [dur_s] [cta_time_s] [out.wav]."""
import os, sys, numpy as np, wave
from PIL import Image, ImageDraw, ImageFont
MDUR = float(sys.argv[1]) if len(sys.argv)>1 else 34.0
CTA_T = float(sys.argv[2]) if len(sys.argv)>2 else 25.6
MOUT = sys.argv[3] if len(sys.argv)>3 else "work/music_up.wav"
SKIP_CARD = len(sys.argv)>1

W,H=1080,1920
GREEN=(15,61,46); GREEN_MED=(46,125,90); ORANGE=(255,122,0); WHITE=(255,255,255); CINZA=(225,228,222)
F=lambda n,s: ImageFont.truetype("fonts/"+n,s)
logo=Image.open("work/logo.png").convert("RGBA")
def center(d,y,t,f,fill,ls=0):
    if ls==0:
        w=d.textlength(t,font=f); d.text(((W-w)/2,y),t,font=f,fill=fill)
    else:
        tot=sum(d.textlength(c,font=f)+ls for c in t)-ls; x=(W-tot)/2
        for c in t: d.text((x,y),c,font=f,fill=fill); x+=d.textlength(c,font=f)+ls

if not SKIP_CARD:
    img=Image.new("RGB",(W,H),GREEN); d=ImageDraw.Draw(img)
    lg=logo.resize((300,300),Image.LANCZOS); img.paste(lg,((W-300)//2,300),lg)
    center(d,760,"AGENDE SUA",F("Poppins-Bold.ttf",100),WHITE)
    center(d,880,"CONSULTA",F("Poppins-Bold.ttf",100),ORANGE)
    d.rectangle([(W/2-80,1050),(W/2+80,1058)],fill=ORANGE)
    center(d,1120,"WhatsApp (11) 99288-3123",F("Poppins-SemiBold.ttf",56),WHITE)
    center(d,1210,"(11) 4587-1216 · 24 Horas",F("Poppins-Medium.ttf",46),CINZA)
    center(d,1290,"Rua Bom Jesus de Pirapora, 2654 · Jundiaí/SP",F("Poppins-Medium.ttf",32),CINZA)
    d.rectangle([(0,1720),(W,1860)],fill=GREEN_MED)
    center(d,1758,"Medicina de ponta. Amor que fica.",F("Poppins-SemiBold.ttf",44),WHITE)
    img.save("work/cta_agende.png"); print("cta_agende ok")

# ---------- trilha upbeat (104 BPM, C-G-Am-F) ----------
SR=44100; DUR=MDUR; N=int(SR*DUR)
BPM=104; beat=60/BPM; bar=4*beat
prog=[(261.63,[261.63,329.63,392.00]),(196.00,[246.94,293.66,392.00]),
      (220.00,[261.63,329.63,440.00]),(174.61,[220.00,261.63,349.23])]
L=np.zeros(N); R=np.zeros(N)
def env(n,a,r,sus=1.0):
    e=np.full(n,sus); ai=min(int(a*SR),n); ri=min(int(r*SR),max(0,n-ai))
    if ai>0: e[:ai]=np.linspace(0,sus,ai)
    if ri>0: e[-ri:]=np.linspace(sus,0,ri)
    return e
def pluck(f,dsec):
    n=int(dsec*SR); t=np.arange(n)/SR
    s=np.sin(2*np.pi*f*t)+0.5*np.sin(2*np.pi*2*f*t)+0.22*np.sin(2*np.pi*3*f*t)
    return s*np.exp(-t/0.16)*(1-np.exp(-t/0.004))
def kick(dsec=0.16):
    n=int(dsec*SR); t=np.arange(n)/SR
    return np.sin(2*np.pi*(120*np.exp(-t*26)+42)*t)*np.exp(-t/0.075)
def clap(dsec=0.11):
    n=int(dsec*SR); x=np.random.randn(n)
    return np.convolve(x,np.ones(6)/6,mode="same")*np.exp(-np.arange(n)/(0.035*SR))
def put(A,p,s):
    if p>=N or p<0: return
    e=min(N,p+len(s)); A[p:e]+=s[:e-p]
tt=0.0; bi=0
while tt<DUR-0.1:
    bass,chord=prog[bi%4]
    p0=int(tt*SR); nb=int(bar*SR)
    tb=np.arange(min(nb,N-p0))/SR
    pad=sum(np.sin(2*np.pi*f*tb)+0.3*np.sin(2*np.pi*f*2.003*tb) for f in chord)/len(chord)
    pad*=env(len(tb),0.5,0.5,0.16)
    L[p0:p0+len(tb)]+=pad*0.9; R[p0:p0+len(tb)]+=pad*0.9
    for e8 in range(8):
        st=tt+e8*beat/2
        if st>=DUR-0.3: break
        f=chord[e8%3]*(2 if e8%4 in(1,3) else 1)
        s=pluck(f,0.30)*0.24; p=int(st*SR)
        put(L if e8%2==0 else R,p,s)
        bl=np.sin(2*np.pi*bass*np.arange(int(beat/2*SR))/SR)*np.exp(-np.arange(int(beat/2*SR))/(0.14*SR))*0.30
        put(L,p,bl); put(R,p,bl)
    if bi>=2:
        for b4 in range(4):
            p=int((tt+b4*beat)*SR); k=kick()*0.5
            put(L,p,k); put(R,p,k)
    if bi>=4:
        for b4 in(1,3):
            p=int((tt+b4*beat)*SR); c=clap()*0.20
            put(L,p,c); put(R,p,c)
    tt+=bar; bi+=1
# riser terminando no CTA + impacto no CTA
rn=int(2.0*SR); rx=np.random.randn(rn)
rx=np.convolve(rx,np.ones(10)/10,mode="same")*((np.arange(rn)/rn)**2.4)*0.5
put(L,int((CTA_T-2.05)*SR),rx); put(R,int((CTA_T-2.05)*SR),rx)
imp=kick(0.5)*1.1
put(L,int((CTA_T+0.05)*SR),imp); put(R,int((CTA_T+0.05)*SR),imp)
mix=np.stack([L,R],axis=1)
sw=np.linspace(0.75,1.0,N)[:,None]; mix*=sw
fi,fo=int(0.6*SR),int(2.8*SR)
mix[:fi]*=np.linspace(0,1,fi)[:,None]; mix[-fo:]*=np.linspace(1,0,fo)[:,None]
mix/= (np.abs(mix).max()+1e-9); mix*=0.75
with wave.open(MOUT,"wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix*32767).astype(np.int16).tobytes())
print("music ok",DUR,"s ->",MOUT)
