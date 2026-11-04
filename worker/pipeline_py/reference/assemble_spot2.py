# -*- coding: utf-8 -*-
"""PROPAGANDA 4K: 6 cenas Seedance + endcard logo. Dissolves de filme, booms, trilha cinematica, VO Apple-style."""
import subprocess, os, json
import numpy as np, wave

W,H,FPS,XF = 1080,1920,30,0.5
FF=["ffmpeg","-hide_banner","-v","error","-y"]
def run(c): subprocess.run(c,check=True)
def dur(p): return float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",p]).strip())

order=["s1_macro","s2_case","s3_executivo","s4_evento","s5_frota","s6_golden"]
GRADE="eq=contrast=1.06:saturation=1.10,unsharp=5:5:0.35"
print("[1/6] preprocess cenas (watermark logo)")
for i,n in enumerate(order):
    src=f"videos_s/{n}.mp4"; s=dur(src); target=min(s,5.0)+XF; fac=target/s
    run(FF+["-i",src,"-i","work/logo_branca.png","-filter_complex",
        f"[0:v]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},setpts={fac:.5f}*PTS,fps={FPS},{GRADE}[v0];"
        f"[1:v]scale=150:-1,format=rgba,colorchannelmixer=aa=0.55[lg];[v0][lg]overlay=W-w-42:52,format=yuv420p[v]",
        "-map","[v]","-an","-c:v","libx264","-crf","17",f"work/p2_{i}.mp4"])
# endcard: logo_intro esticado + CTA
ec_src="motion_out/logo_intro.mp4"; s=dur(ec_src); ECD=4.8; fac=ECD/s
run(FF+["-i",ec_src,"-an","-vf",f"scale={W}:{H},setpts={fac:.5f}*PTS,fps={FPS},format=yuv420p","-c:v","libx264","-crf","17","work/p2_6.mp4"])

print("[2/6] xfade dissolves")
n=7
L=[dur(f"work/p2_{i}.mp4") for i in range(n)]
starts=[0.0]
for k in range(1,n): starts.append(starts[-1]+L[k-1]-XF)
trans=["fade","fade","fade","fade","fade","fadeblack"]
inp=[]; chain=""; prev="[0:v]"
for i in range(n): inp+=["-i",f"work/p2_{i}.mp4"]
for k in range(1,n):
    chain+=f"{prev}[{k}:v]xfade=transition={trans[k-1]}:duration={XF}:offset={starts[k]:.3f}[x{k}];"
    prev=f"[x{k}]"
run(FF+inp+["-filter_complex",chain.rstrip(";"),"-map",prev,"-c:v","libx264","-crf","17","-pix_fmt","yuv420p","work/tl2s.mp4"])
TOT=dur("work/tl2s.mp4"); EC_T=starts[6]
print("   total",round(TOT,2),"| endcard",round(EC_T,2))

print("[3/6] CTA no endcard")
def ts(x): h=int(x//3600); m=int(x%3600//60); s2=x%60; return f"{h}:{m:02d}:{s2:05.2f}"
a=EC_T+1.5; b=TOT-0.15
ev=[f"Dialogue: 0,{ts(a)},{ts(b)},CTA,,0,0,0,,{{\\an5\\pos(540,1210)\\fad(300,200)}}ALUGUE O {{\\1c&H29BAA4&}}IPHONE 17 PRO MAX{{\\1c&HFFFFFF&}}",
    f"Dialogue: 0,{ts(a+0.5)},{ts(b)},Sub,,0,0,0,,{{\\an5\\pos(540,1320)\\fad(300,200)}}brmobile.com.br"]
ass=("[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\nWrapStyle: 2\nScaledBorderAndShadow: yes\n\n"
 "[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
 "Style: CTA,Poppins,64,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,1,0,0,0,100,100,3,0,1,0,0,5,60,60,60,1\n"
 "Style: Sub,Poppins,42,&H00DDDDDD,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,2,0,1,0,0,5,60,60,60,1\n\n"
 "[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"+"\n".join(ev)+"\n")
open("work/cta2.ass","w",encoding="utf-8").write(ass)
run(FF+["-i","work/tl2s.mp4","-vf","subtitles=work/cta2.ass:fontsdir=fonts","-an","-c:v","libx264","-crf","17","-pix_fmt","yuv420p","work/tl2s_txt.mp4"])

print("[4/6] trilha cinematica + booms")
SR=44100; N=int(SR*(TOT+0.5)); Lc=np.zeros(N); Rc=np.zeros(N)
def put(A,p,s):
    if p<0 or p>=N: return
    e=min(N,p+len(s)); A[p:e]+=s[:e-p]
beat=60/80.0
prog=[110.00,87.31,98.00,82.41]  # A F G E baixo
tt=0.0; bi=0
while tt<TOT:
    bass=prog[bi%4]; bar=4*beat
    nb=int(bar*SR); tb=np.arange(nb)/SR
    pad=(np.sin(2*np.pi*bass*2*tb)+0.5*np.sin(2*np.pi*bass*3*tb)+0.3*np.sin(2*np.pi*bass*4.01*tb))
    envp=np.minimum(1,np.minimum(tb/1.2,(bar-tb)/1.2).clip(0)) if bar>2.4 else np.hanning(nb)
    put(Lc,int(tt*SR),pad*envp*0.16); put(Rc,int(tt*SR),pad*envp*0.16)
    for e8 in range(8):
        st=tt+e8*beat/2
        if st>=TOT: break
        nn=int(0.22*SR); tb2=np.arange(nn)/SR
        pl=np.sin(2*np.pi*bass*tb2)*np.exp(-tb2/0.09)*0.3
        put(Lc,int(st*SR),pl); put(Rc,int(st*SR),pl)
    tt+=bar; bi+=1
def boom(g=0.6):
    nn=int(0.8*SR); tb2=np.arange(nn)/SR
    s=np.sin(2*np.pi*(55*np.exp(-tb2*3)+38)*tb2)*np.exp(-tb2/0.30)
    x=np.random.randn(nn)*np.exp(-tb2/0.05)*0.3
    return (s+np.convolve(x,np.ones(30)/30,mode="same"))*g
for k in range(1,7):
    bm=boom(0.55 if k<6 else 0.8)
    put(Lc,int((starts[k]-0.05)*SR),bm); put(Rc,int((starts[k]-0.05)*SR),bm)
rn=int(2.2*SR); rx=np.random.randn(rn)
rx=np.convolve(rx,np.ones(12)/12,mode="same")*((np.arange(rn)/rn)**2.6)*0.4
put(Lc,int((EC_T-2.2)*SR),rx); put(Rc,int((EC_T-2.2)*SR),rx)
mix=np.stack([Lc,Rc],axis=1)
fi,fo=int(0.8*SR),int(2.6*SR)
mix[:fi]*=np.linspace(0,1,fi)[:,None]
if N>fo: mix[int((TOT+0.5)*SR)-fo:int((TOT+0.5)*SR)]*=np.linspace(1,0,fo)[:,None]
mix/=max(1.0,np.abs(mix).max()); mix*=0.8
with wave.open("work/music_cine.wav","wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix*32767).astype(np.int16).tobytes())

print("[5/6] mix VO")
vo_files=[f"vo_s/vo{i}.mp3" for i in range(1,7)]
vd=[dur(f) for f in vo_files]
vo_t=[starts[0]+0.9, starts[1]+0.5, starts[3]+0.4, starts[4]+0.4, starts[5]+0.5, EC_T+0.9]
inputs=["-i","work/tl2s_txt.mp4"]
for f in vo_files: inputs+=["-i",f]
inputs+=["-i","work/music_cine.wav"]
fc=""
for k in range(1,7):
    ms=int(vo_t[k-1]*1000); fc+=f"[{k}:a]adelay={ms}|{ms},apad=whole_dur={TOT:.2f}[v{k}];"
fc+="".join(f"[v{k}]" for k in range(1,7))+"amix=inputs=6:duration=longest:normalize=0,volume=2.0,asplit=2[voA][voB];"
fc+=f"[7:a]volume=0.75,atrim=0:{TOT:.2f}[mus];[mus][voA]sidechaincompress=threshold=0.025:ratio=4:attack=25:release=500[msc];"
fc+=f"[voB][msc]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.93,loudnorm=I=-14:TP=-1.2:LRA=11[a]"
run(FF+inputs+["-filter_complex",fc,"-map","0:v","-map","[a]","-c:v","copy","-c:a","aac","-b:a","192k","-shortest","-movflags","+faststart","BRMOBILE-PROPAGANDA-1080.mp4"])

print("[6/6] master 4K")
run(FF+["-i","BRMOBILE-PROPAGANDA-1080.mp4","-vf","scale=2160:3840:flags=lanczos,unsharp=5:5:0.3","-c:v","libx264","-crf","17","-preset","slow","-c:a","copy","-movflags","+faststart","BRMOBILE-PROPAGANDA-4K.mp4"])
run(FF+["-i","BRMOBILE-PROPAGANDA-1080.mp4","-vf","select='not(mod(n,50))',scale=200:-1,tile=6x3","-frames:v","1","contact_spot2.png"])
print("OK", round(dur("BRMOBILE-PROPAGANDA-4K.mp4"),2),"s")
