# -*- coding: utf-8 -*-
"""PROPAGANDA CAPTACAO PRATIQUE BOXE: 6 cenas (5 IA + Caio real) + endcard badge + LEGENDAS douradas + trilha + VO."""
import subprocess, os, json, re, shutil
import numpy as np, wave
from PIL import Image, ImageDraw, ImageFont

W,H,FPS,XF = 1080,1920,30,0.5
FF=["ffmpeg","-hide_banner","-v","error","-y"]
PY=r"C:\Users\f.serrano\AppData\Local\Programs\Python\Python312\python.exe"
def run(c): subprocess.run(c,check=True)
def dur(p): return float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",p]).strip())

FONTS = r"C:\Users\f.serrano\Downloads\fortuna-creative\worker\pipeline_py\fonts"
if not os.path.isdir("fonts"): shutil.copytree(FONTS,"fonts")
BADGE = "carrossel_brand/_badge.png"
BLACK=(13,13,13); RED=(200,16,46); GOLD=(201,162,39); WHITE=(245,245,245)
F=lambda n,s: ImageFont.truetype(os.path.join("fonts",n),s)

print("[0/6] endcard captacao")
img=Image.new("RGB",(W,H),BLACK); d=ImageDraw.Draw(img)
import math
for i in range(7):
    x0=-60+i*26; d.line([(x0,H+40),(x0+340*math.cos(math.radians(45)), H+40-340*math.sin(math.radians(45)))], fill=RED, width=10)
bg=Image.open(BADGE).convert("RGBA").resize((430,430),Image.LANCZOS)
img.paste(bg,((W-430)//2,240),bg)
def center(y,t,f,fill):
    w=d.textlength(t,font=f); d.text(((W-w)/2,y),t,font=f,fill=fill)
center(760,"AGENDE SUA AULA",F("Poppins-Bold.ttf",92),WHITE)
center(870,"EXPERIMENTAL",F("Poppins-Bold.ttf",92),GOLD)
d.rounded_rectangle((W//2-320,1060,W//2+320,1170), radius=26, fill=RED)
center(1090,"CHAMA NO DIRECT",F("Poppins-Bold.ttf",46),WHITE)
center(1250,"Disciplina, respeito, foco e evolução.",F("Poppins-Medium.ttf",36),(160,160,160))
d.rectangle((0,H-92,W,H), fill=(22,22,22)); d.rectangle((0,H-92,W,H-86), fill=RED)
center(H-66,"EQUIPE PRATIQUE BOXE · BOXE E MUAY-THAI",F("Poppins-Medium.ttf",28),(160,160,160))
img.save("work_p/endcard.png")

order=["b1_luvas","b2_saco","b3_caio","b4_aula","b5_ringue","b6_golden"]
GRADE="eq=contrast=1.08:saturation=1.12,unsharp=5:5:0.35"
print("[1/6] preprocess (watermark badge)")
for i,n in enumerate(order):
    src=f"videos_p/{n}.mp4"; s=dur(src); target=min(s,5.0)+XF; fac=target/s
    run(FF+["-i",src,"-i",BADGE,"-filter_complex",
        f"[0:v]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},setpts={fac:.5f}*PTS,fps={FPS},{GRADE}[v0];"
        f"[1:v]scale=120:-1,format=rgba,colorchannelmixer=aa=0.75[lg];[v0][lg]overlay=W-w-40:44,format=yuv420p[v]",
        "-map","[v]","-an","-c:v","libx264","-crf","17",f"work_p/p{i}.mp4"])
ECD=5.0
run(FF+["-loop","1","-i","work_p/endcard.png","-t",f"{ECD}","-an","-vf",
    f"scale={W}:{H},fade=t=in:st=0:d=0.5,fade=t=out:st={ECD-0.6:.2f}:d=0.6,fps={FPS},format=yuv420p",
    "-c:v","libx264","-crf","17","work_p/p6.mp4"])

print("[2/6] dissolves + booms de corte")
n=7
L=[dur(f"work_p/p{i}.mp4") for i in range(n)]
starts=[0.0]
for k in range(1,n): starts.append(starts[-1]+L[k-1]-XF)
trans=["fade","fade","fade","fade","fade","fadeblack"]
inp=[]; chain=""; prev="[0:v]"
for i in range(n): inp+=["-i",f"work_p/p{i}.mp4"]
for k in range(1,n):
    chain+=f"{prev}[{k}:v]xfade=transition={trans[k-1]}:duration={XF}:offset={starts[k]:.3f}[x{k}];"
    prev=f"[x{k}]"
run(FF+inp+["-filter_complex",chain.rstrip(";"),"-map",prev,"-c:v","libx264","-crf","17","-pix_fmt","yuv420p","work_p/tl.mp4"])
TOT=dur("work_p/tl.mp4"); EC_T=starts[6]
print("   total",round(TOT,2),"| endcard",round(EC_T,2))

print("[3/6] LEGENDAS (dourado brand)")
GOLD_ASS="{\\1c&H27A2C9&}"; WHT="{\\1c&HFFFFFF&}"   # C9A227 em BGR
KW=["boxe","muay-thai","muay thai","caio serrano","mestre","disciplina","foco","confiança","confianca",
    "evolução","evolucao","equipe","aula experimental","experimental","pratique","iniciante","treinar","treino"]
vo_lines=json.load(open("work_p/copy.json",encoding="utf-8"))["vo"]
vd=[dur(f"vo_p/vo{i}.mp3") for i in range(1,7)]
vo_t=[starts[0]+0.7, starts[1]+0.4, starts[2]+0.4, starts[3]+0.4, starts[4]+0.4, EC_T+0.7]
def ts(x): h=int(x//3600); m=int(x%3600//60); s2=x%60; return f"{h}:{m:02d}:{s2:05.2f}"
pat=re.compile(r"(?i)\b("+"|".join(re.escape(k) for k in sorted(KW,key=len,reverse=True))+r")\b")
ev=[]
for i,line in enumerate(vo_lines):
    a=vo_t[i]-0.1; b=vo_t[i]+vd[i]+0.5
    line=pat.sub(lambda m: GOLD_ASS+m.group(0)+WHT, line)
    ev.append(f"Dialogue: 0,{ts(a)},{ts(b)},Cap,,0,0,0,,{{\\fad(110,110)}}{line}")
ass=("[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\nWrapStyle: 2\nScaledBorderAndShadow: yes\n\n"
 "[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
 "Style: Cap,Poppins,64,&H00FFFFFF,&H000000FF,&H00000000,&H8C000000,1,0,0,0,100,100,1,0,1,4,2,2,90,90,220,1\n\n"
 "[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"+"\n".join(ev)+"\n")
open("work_p/cap.ass","w",encoding="utf-8").write(ass)
run(FF+["-i","work_p/tl.mp4","-vf","subtitles=work_p/cap.ass:fontsdir=fonts","-an","-c:v","libx264","-crf","17","-pix_fmt","yuv420p","work_p/tl_txt.mp4"])

print("[4/6] trilha energia (booms) — Artlist se existir")
music_dir=r"C:\Users\f.serrano\Downloads\fortuna-creative\worker\assets\music"
artlist=[f for f in (os.listdir(music_dir) if os.path.isdir(music_dir) else []) if f.lower().endswith(('.mp3','.wav'))]
if artlist:
    src=os.path.join(music_dir,artlist[0])
    run(FF+["-i",src,"-t",f"{TOT:.2f}","-af",f"afade=t=in:st=0:d=0.8,afade=t=out:st={TOT-2.4:.2f}:d=2.3","work_p/music.wav"])
    print("   usando Artlist:",artlist[0])
else:
    run([PY,r"C:\Users\f.serrano\Downloads\fortuna-creative\worker\pipeline_py\reference\prep_assets.py",f"{TOT:.2f}",f"{EC_T:.2f}","work_p/music.wav"])
    print("   trilha propria (sem Artlist na pasta)")
SR=44100; N=int(SR*(TOT+0.5)); buf=np.zeros(N)
def boom(g=0.6):
    nn=int(0.8*SR); tb=np.arange(nn)/SR
    s=np.sin(2*np.pi*(55*np.exp(-tb*3)+38)*tb)*np.exp(-tb/0.30)
    x=np.random.randn(nn)*np.exp(-tb/0.05)*0.3
    return (s+np.convolve(x,np.ones(30)/30,mode="same"))*g
for k in range(1,7):
    bm=boom(0.55 if k<6 else 0.85)
    p=int((starts[k]-0.05)*SR); e=min(N,p+len(bm)); buf[p:e]+=bm[:e-p]
buf/=max(1.0,np.abs(buf).max())
with wave.open("work_p/sfx.wav","wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((buf*0.9*32767).astype(np.int16).tobytes())

print("[5/6] mix")
inputs=["-i","work_p/tl_txt.mp4"]
for i in range(1,7): inputs+=["-i",f"vo_p/vo{i}.mp3"]
inputs+=["-i","work_p/music.wav","-i","work_p/sfx.wav"]
fc=""
for k in range(1,7):
    ms=int(vo_t[k-1]*1000); fc+=f"[{k}:a]adelay={ms}|{ms},apad=whole_dur={TOT:.2f}[v{k}];"
fc+="".join(f"[v{k}]" for k in range(1,7))+"amix=inputs=6:duration=longest:normalize=0,volume=2.0,asplit=2[voA][voB];"
fc+=f"[7:a]volume=0.68,atrim=0:{TOT:.2f}[mus];[mus][voA]sidechaincompress=threshold=0.02:ratio=6:attack=15:release=450[msc];"
fc+=f"[8:a]volume=0.95,apad[sx];[voB][msc][sx]amix=inputs=3:duration=first:normalize=0,alimiter=limit=0.93,loudnorm=I=-14:TP=-1.2:LRA=11[a]"
run(FF+inputs+["-filter_complex",fc,"-map","0:v","-map","[a]","-c:v","copy","-c:a","aac","-b:a","192k","-shortest","-movflags","+faststart","PRATIQUE-BOXE-CAPTACAO-1080.mp4"])

print("[6/6] master 4K + sheet")
run(FF+["-i","PRATIQUE-BOXE-CAPTACAO-1080.mp4","-vf","scale=2160:3840:flags=lanczos,unsharp=5:5:0.3","-c:v","libx264","-crf","17","-preset","slow","-c:a","copy","-movflags","+faststart","PRATIQUE-BOXE-CAPTACAO-4K.mp4"])
run(FF+["-i","PRATIQUE-BOXE-CAPTACAO-1080.mp4","-vf","select='not(mod(n,50))',scale=200:-1,tile=6x3","-frames:v","1","contact_captacao.png"])
print("OK",round(dur("PRATIQUE-BOXE-CAPTACAO-4K.mp4"),2),"s")
