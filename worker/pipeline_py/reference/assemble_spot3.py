# -*- coding: utf-8 -*-
"""LAVIH SPA: 6 cenas Seedance + endcard bege/dourado + LEGENDAS sincronizadas + trilha serena + VO feminina."""
import subprocess, os, json, re
import numpy as np, wave
from PIL import Image, ImageDraw, ImageFont

W,H,FPS,XF = 1080,1920,30,0.6
FF=["ffmpeg","-hide_banner","-v","error","-y"]
def run(c): subprocess.run(c,check=True)
def dur(p): return float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",p]).strip())

BEIGE=(240,231,216); GOLD=(180,140,60); INK=(60,48,35)
LOGO=r"C:\Users\f.serrano\Downloads\lavih-central\logos\lavih-logo.png"
F=lambda n,s: ImageFont.truetype("fonts/"+n,s)

print("[0/6] endcard bege+dourado")
img=Image.new("RGB",(W,H),BEIGE); d=ImageDraw.Draw(img)
lg=Image.open(LOGO).convert("RGBA")
lw=560; lh=int(lg.height*lw/lg.width); lg=lg.resize((lw,lh),Image.LANCZOS)
img.paste(lg,((W-lw)//2,620),lg)
d.rectangle([(W/2-70,620+lh+70),(W/2+70,620+lh+76)],fill=GOLD)
def center(y,t,f,fill):
    w=d.textlength(t,font=f); d.text(((W-w)/2,y),t,font=f,fill=fill)
center(620+lh+130,"ADQUIRA SEU VALE-SPA",F("Poppins-SemiBold.ttf",58),INK)
center(620+lh+220,"lavihspa.com.br",F("Poppins-Medium.ttf",44),GOLD)
img.save("work/lavih_endcard.png")

order=["l1_agua","l2_headspa","l4_drenagem","l3_pedras","l5_ambiente","l6_saida"]  # ordem = arco da copy (drenagem antes de pedras)
GRADE="eq=contrast=1.05:saturation=1.08:brightness=0.01,unsharp=5:5:0.3"
print("[1/6] preprocess (watermark discreto)")
for i,n in enumerate(order):
    src=f"videos_l/{n}.mp4"; s=dur(src); target=min(s,5.0)+XF; fac=target/s
    run(FF+["-i",src,"-i",LOGO,"-filter_complex",
        f"[0:v]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},setpts={fac:.5f}*PTS,fps={FPS},{GRADE}[v0];"
        f"[1:v]scale=170:-1,format=rgba,colorchannelmixer=aa=0.5[lg];[v0][lg]overlay=W-w-40:48,format=yuv420p[v]",
        "-map","[v]","-an","-c:v","libx264","-crf","17",f"work/l{i}.mp4"])
ECD=5.0
Fn=int(ECD*FPS)
run(FF+["-loop","1","-i","work/lavih_endcard.png","-t",f"{ECD}","-an","-vf",
    f"scale={W}:{H},fade=t=in:st=0:d=0.6,fade=t=out:st={ECD-0.6:.2f}:d=0.6,fps={FPS},format=yuv420p",
    "-c:v","libx264","-crf","17","work/l6.mp4"])

print("[2/6] dissolves")
n=7
L=[dur(f"work/l{i}.mp4") for i in range(n)]
starts=[0.0]
for k in range(1,n): starts.append(starts[-1]+L[k-1]-XF)
trans=["fade"]*5+["fadewhite"]
inp=[]; chain=""; prev="[0:v]"
for i in range(n): inp+=["-i",f"work/l{i}.mp4"]
for k in range(1,n):
    chain+=f"{prev}[{k}:v]xfade=transition={trans[k-1]}:duration={XF}:offset={starts[k]:.3f}[x{k}];"
    prev=f"[x{k}]"
run(FF+inp+["-filter_complex",chain.rstrip(";"),"-map",prev,"-c:v","libx264","-crf","17","-pix_fmt","yuv420p","work/tl3.mp4"])
TOT=dur("work/tl3.mp4"); EC_T=starts[6]
print("   total",round(TOT,2),"| endcard",round(EC_T,2))

print("[3/6] LEGENDAS sincronizadas (dourado)")
GOLD_ASS="{\\1c&H3C8CB4&}"; WHT="{\\1c&HFFFFFF&}"   # dourado ~#B48C3C em BGR
KW=["head spa","harmonia total","drenagem linfática","drenagem linfatica","sensorial","pedras quentes","ritual",
    "vale-spa","vale spa","lavih","refúgio","refugio","bem-estar","autocuidado","desacelerar"]
vo_lines=json.load(open("work_l/copy.json",encoding="utf-8"))["vo"]
vd=[dur(f"vo_l/vo{i}.mp3") for i in range(1,7)]
vo_t=[starts[0]+0.8, starts[1]+0.5, starts[2]+0.5, starts[3]+0.5, starts[4]+0.5, EC_T+0.7]
def ts(x): h=int(x//3600); m=int(x%3600//60); s2=x%60; return f"{h}:{m:02d}:{s2:05.2f}"
pat=re.compile(r"(?i)\b("+"|".join(re.escape(k) for k in sorted(KW,key=len,reverse=True))+r")\b")
ev=[]
for i,line in enumerate(vo_lines):
    a=vo_t[i]-0.1; b=vo_t[i]+vd[i]+0.5
    line=pat.sub(lambda m: GOLD_ASS+m.group(0)+WHT, line)
    ev.append(f"Dialogue: 0,{ts(a)},{ts(b)},Cap,,0,0,0,,{{\\fad(120,120)}}{line}")
ass=("[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\nWrapStyle: 2\nScaledBorderAndShadow: yes\n\n"
 "[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
 "Style: Cap,Poppins,62,&H00FFFFFF,&H000000FF,&H00000000,&H8C000000,0,0,0,0,100,100,1,0,1,4,2,2,90,90,220,1\n\n"
 "[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"+"\n".join(ev)+"\n")
open("work/lav.ass","w",encoding="utf-8").write(ass)
run(FF+["-i","work/tl3.mp4","-vf","subtitles=work/lav.ass:fontsdir=fonts","-an","-c:v","libx264","-crf","17","-pix_fmt","yuv420p","work/tl3_txt.mp4"])

print("[4/6] trilha serena")
SR=44100; N=int(SR*(TOT+0.5)); Lc=np.zeros(N); Rc=np.zeros(N)
def put(A,p,s):
    if p<0 or p>=N: return
    e=min(N,p+len(s)); A[p:e]+=s[:e-p]
beat=60/68.0
prog=[130.81,110.00,87.31,98.00]  # C A F G graves suaves
tt=0.0; bi=0
while tt<TOT:
    bass=prog[bi%4]; bar=4*beat
    nb=int(bar*SR); tb=np.arange(nb)/SR
    pad=(np.sin(2*np.pi*bass*tb)+0.6*np.sin(2*np.pi*bass*2.005*tb)+0.35*np.sin(2*np.pi*bass*3*tb))
    e2=np.hanning(nb)
    put(Lc,int(tt*SR),pad*e2*0.15); put(Rc,int(tt*SR),pad*e2*0.15)
    for q in (0,2):
        st=tt+q*beat
        if st>=TOT: break
        nn=int(1.2*SR); tb2=np.arange(nn)/SR
        bell=np.sin(2*np.pi*bass*4*tb2)*np.exp(-tb2/0.5)*0.06
        put(Lc if q==0 else Rc,int(st*SR),bell)
    tt+=bar; bi+=1
mix=np.stack([Lc,Rc],axis=1)
fi,fo=int(1.2*SR),int(3.0*SR)
mix[:fi]*=np.linspace(0,1,fi)[:,None]
end=int(TOT*SR); mix[max(0,end-fo):end]*=np.linspace(1,0,min(fo,end))[:,None]
mix/=max(1.0,np.abs(mix).max()); mix*=0.7
with wave.open("work/music_lav.wav","wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix*32767).astype(np.int16).tobytes())

print("[5/6] mix VO")
inputs=["-i","work/tl3_txt.mp4"]
for i in range(1,7): inputs+=["-i",f"vo_l/vo{i}.mp3"]
inputs+=["-i","work/music_lav.wav"]
fc=""
for k in range(1,7):
    ms=int(vo_t[k-1]*1000); fc+=f"[{k}:a]adelay={ms}|{ms},apad=whole_dur={TOT:.2f}[v{k}];"
fc+="".join(f"[v{k}]" for k in range(1,7))+"amix=inputs=6:duration=longest:normalize=0,volume=2.0,asplit=2[voA][voB];"
fc+=f"[7:a]volume=0.8,atrim=0:{TOT:.2f}[mus];[mus][voA]sidechaincompress=threshold=0.03:ratio=3.5:attack=30:release=600[msc];"
fc+=f"[voB][msc]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.93,loudnorm=I=-15:TP=-1.3:LRA=11[a]"
run(FF+inputs+["-filter_complex",fc,"-map","0:v","-map","[a]","-c:v","copy","-c:a","aac","-b:a","192k","-shortest","-movflags","+faststart","LAVIH-SPA-PROPAGANDA-1080.mp4"])

print("[6/6] master 4K + sheet")
run(FF+["-i","LAVIH-SPA-PROPAGANDA-1080.mp4","-vf","scale=2160:3840:flags=lanczos,unsharp=5:5:0.3","-c:v","libx264","-crf","17","-preset","slow","-c:a","copy","-movflags","+faststart","LAVIH-SPA-PROPAGANDA-4K.mp4"])
run(FF+["-i","LAVIH-SPA-PROPAGANDA-1080.mp4","-vf","select='not(mod(n,50))',scale=200:-1,tile=6x3","-frames:v","1","contact_lavih.png"])
print("OK",round(dur("LAVIH-SPA-PROPAGANDA-4K.mp4"),2),"s")
