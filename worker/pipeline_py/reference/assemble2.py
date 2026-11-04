# -*- coding: utf-8 -*-
"""PROVADO: montagem final — sweeps de marca, VO com ducking, kinetic type estavel, trilha sob medida.
Gerou COMERCIAL-JUNDPET-V2-9x16.mp4 (41.2s) entregue. Paths V2 historicos -> adaptar pro worker."""
import subprocess, os
import numpy as np, wave

W,H,FPS,XF = 1080,1920,30,0.30
FF=["ffmpeg","-hide_banner","-v","error","-y"]
def run(c): subprocess.run(c,check=True)
def dur(p): return float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",p]).strip())
def clamp(x,a,b): return max(a,min(b,x))

vo={k:dur(f"vo/vo{k}.mp3") for k in range(1,8)}
print("VO durs:",{k:round(v,2) for k,v in vo.items()})

d1=clamp(vo[1]+0.9,4.0,5.2); dF=clamp(vo[2]+1.0,4.0,5.2); d2=clamp(vo[3]+0.9,4.2,5.8)
d3=clamp(vo[4]+0.9,4.0,5.2); d4=clamp(vo[5]+0.9,4.0,5.2); d5=clamp(vo[6]+0.9,4.0,5.2)
dC=vo[7]+1.5
segs=[("panel","work/panel_open.png",1.25),
 ("clip","videos/s1_hook.mp4",d1),
 ("panel","work/panel_open.png",0.85),
 ("clip","videos/s0_fachada.mp4",dF),
 ("clip","videos/s2_clinica.mp4",d2),
 ("panel","work/panel_silvestres.png",0.95),
 ("clip","videos/s3_exame.mp4",d3),
 ("panel","work/panel_24h.png",0.95),
 ("clip","videos/s4_tech.mp4",d4),
 ("clip","videos/s5_final.mp4",d5),
 ("panel","work/cta_agende.png",dC)]
trans=["slideleft","slideleft","slideleft","smoothleft","slideleft","slideleft","slideleft","slideleft","fade","slideup"]
n=len(segs)

print("[1/6] preprocess (sem zoompan/noise = sem tremido)")
for i,(typ,src,dd) in enumerate(segs):
    out=f"work/m{i}.mp4"
    Li=dd+(XF if i<n-1 else 0.0)   # PADDING pro overlap do xfade — OBRIGATORIO
    if typ=="panel":
        vf=f"scale={W}:{H},format=yuv420p"
        if i==0: vf+= ",fade=t=in:st=0:d=0.35"
        if i==n-1: vf+= f",fade=t=out:st={Li-0.5:.2f}:d=0.5"
        run(FF+["-loop","1","-i",src,"-t",f"{Li}","-an","-vf",vf,"-r",f"{FPS}","-c:v","libx264","-crf","18",out])
    else:
        s=dur(src); fac=Li/s
        run(FF+["-i",src,"-an","-vf",
            f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},setpts={fac:.5f}*PTS,fps={FPS},"
            f"eq=contrast=1.05:saturation=1.08,format=yuv420p","-c:v","libx264","-crf","18",out])

print("[2/6] xfade sweeps")
L=[segs[i][2]+(XF if i<n-1 else 0.0) for i in range(n)]
starts=[0.0]
for k in range(1,n): starts.append(starts[-1]+L[k-1]-XF)
inp=[]; chain=""; prev="[0:v]"
for i in range(n): inp+=["-i",f"work/m{i}.mp4"]
for k in range(1,n):
    off=starts[k]; lab=f"[x{k}]"
    chain+=f"{prev}[{k}:v]xfade=transition={trans[k-1]}:duration={XF}:offset={off:.3f}{lab};"
    prev=lab
chain=chain.rstrip(";")
run(FF+inp+["-filter_complex",chain,"-map",prev,"-c:v","libx264","-crf","18","-pix_fmt","yuv420p","work/tl2.mp4"])
TOT=dur("work/tl2.mp4"); CTA_T=starts[10]
print("   total:",round(TOT,2),"s | CTA em",round(CTA_T,2))

print("[3/6] type estavel + endereco")
O="{\\1c&H007AFF&}"; Wt="{\\1c&HFFFFFF&}"
texts={1:f"CUIDADO {O}ESPECIALIZADO{Wt}",4:f"HOSPITAL {O}COMPLETO{Wt}",
       6:f"{O}SILVESTRES{Wt} E EXÓTICOS",8:f"{O}MEDICINA DE PONTA{Wt} · 24H",9:f"EM {O}BOAS MÃOS{Wt}"}
def ts(x): h=int(x//3600); m=int(x%3600//60); s=x%60; return f"{h}:{m:02d}:{s:05.2f}"
ev=[]
for i,t in texts.items():
    a=starts[i]+0.50; b=starts[i]+segs[i][2]-0.35
    mv=f"{{\\an5\\move(540,1526,540,1508,0,320)\\fad(180,150)}}"
    ev.append(f"Dialogue: 0,{ts(a)},{ts(b)},Kin,,0,0,0,,{mv}{t}")
ass=("[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\nWrapStyle: 2\nScaledBorderAndShadow: yes\n\n"
 "[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
 "Style: Kin,Poppins SemiBold,74,&H00FFFFFF,&H000000FF,&H00000000,&H96000000,1,0,0,0,100,100,1,0,1,5,3,5,60,60,60,1\n\n"
 "[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"+"\n".join(ev)+"\n")
open("work/kin2.ass","w",encoding="utf-8").write(ass)
fa,fb=starts[3]+0.45,starts[3]+segs[3][2]-0.30
run(FF+["-i","work/tl2.mp4","-i","work/lower_endereco.png","-filter_complex",
    f"[0:v][1:v]overlay=0:0:enable='between(t,{fa:.2f},{fb:.2f})'[bg];"
    f"[bg]subtitles=work/kin2.ass:fontsdir=fonts[v]",
    "-map","[v]","-an","-c:v","libx264","-crf","18","-pix_fmt","yuv420p","work/final2_v.mp4"])

print("[4/6] trilha sob medida")
run(["python","prep_assets.py",f"{TOT:.2f}",f"{CTA_T:.2f}","work/music_v2.wav"])

print("[5/6] SFX whoosh nos sweeps")
SR=44100
buf=np.zeros(int(SR*(TOT+0.5)))
def whoosh(dd=0.42):
    nn=int(SR*dd); t=np.arange(nn)/SR; x=np.random.randn(nn)
    lp=np.convolve(x,np.ones(24)/24,mode="same")
    s=lp*np.sin(np.pi*t/dd)**2*np.hanning(nn)
    return s/(np.abs(s).max()+1e-9)
wh=whoosh()
for k in range(1,n):
    g=0.55 if trans[k-1].startswith("slide") else 0.3
    p=int(SR*max(0,starts[k]-0.14)); e=min(len(buf),p+len(wh)); buf[p:e]+=wh[:e-p]*g
buf/=max(1.0,np.abs(buf).max())
with wave.open("work/sfx2.wav","wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((buf*0.9*32767).astype(np.int16).tobytes())

print("[6/6] mix final: VO + trilha (duck) + sfx")
vo_starts={1:starts[1]+0.35,2:starts[3]+0.35,3:starts[4]+0.30,4:starts[6]+0.35,5:starts[8]+0.35,6:starts[9]+0.35,7:starts[10]+0.55}
inputs=["-i","work/final2_v.mp4"]
for k in range(1,8): inputs+=["-i",f"vo/vo{k}.mp3"]
inputs+=["-i","work/music_v2.wav","-i","work/sfx2.wav"]
fc=""
for k in range(1,8):
    ms=int(vo_starts[k]*1000)
    fc+=f"[{k}:a]adelay={ms}|{ms},apad=whole_dur={TOT:.2f}[v{k}];"
fc+="".join(f"[v{k}]" for k in range(1,8))+"amix=inputs=7:duration=longest:normalize=0,volume=1.9,asplit=2[voA][voB];"
fc+=f"[8:a]volume=0.62,atrim=0:{TOT:.2f}[mus];[mus][voA]sidechaincompress=threshold=0.02:ratio=7:attack=12:release=420[msc];"
fc+=f"[9:a]volume=0.95,apad[sx];[voB][msc][sx]amix=inputs=3:duration=first:normalize=0,alimiter=limit=0.93,loudnorm=I=-14:TP=-1.2:LRA=11[a]"
run(FF+inputs+["-filter_complex",fc,"-map","0:v","-map","[a]","-c:v","copy","-c:a","aac","-b:a","192k","-shortest","-movflags","+faststart","COMERCIAL-V2-9x16.mp4"])
print("OK", round(dur("COMERCIAL-V2-9x16.mp4"),2),"s")
