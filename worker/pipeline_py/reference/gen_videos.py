# -*- coding: utf-8 -*-
"""PROVADO: anima imagens no Kling 3.0 (image-to-video 5s, paralelo). Mesmo padrao cmd /c."""
import subprocess, json, os, threading, urllib.request, re

M = {
 "s1_hook":"Slow steady push-in toward the seated woman as she gently strokes the cockatiel against her chest, the bird tilts its head, lamp light flickers softly, dust motes drifting in the beam, shallow focus held on the bird.",
 "s2_clinica":"Smooth lateral dolly to the right across the reception counter, the receptionist hands the paperwork with a warm smile, the client lifts the pet carrier slightly, pendant light bokeh drifting, natural daylight steady.",
 "s3_exame":"Slow arcing orbit around the exam table as the veterinarian gently extends the macaw's scarlet wing, feathers shifting under the surgical dome light, the bird blinks calmly, steel table catching moving speculars.",
 "s4_tech":"Slow push toward the diagnostic monitor as the veterinarian points at the wing joint on the radiograph, screen glow pulsing subtly on both faces, the second vet nods, LED bokeh breathing in the dark background.",
 "s5_final":"Camera rises gently from low angle as the smiling man steps forward out of the glass door, the blue-and-gold macaw flaps its wings once and settles, golden sun flare sweeping across the lens, door glass reflecting warm light."
}
os.makedirs("videos",exist_ok=True)
results={}
def gen(name,motion):
    cmd=["cmd","/c","higgsfield","generate","create","kling3_0",
         "--prompt",motion,"--start-image",f"images2/{name}.png",
         "--duration","5","--mode","std","--sound","off",
         "--wait","--wait-timeout","25m","--json"]
    try:
        out=subprocess.check_output(cmd,stderr=subprocess.STDOUT,timeout=1800).decode("utf-8",errors="replace")
        m=re.search(r'\{.*\}',out,re.S)
        j=json.loads(m.group(0)) if m else {}
        url=j.get("result_url") or (j.get("results") or [{}])[0].get("url") or j.get("url")
        if not url:
            urls=re.findall(r'https://\S+\.mp4',out); url=urls[0] if urls else None
        if url:
            urllib.request.urlretrieve(url,f"videos/{name}.mp4"); results[name]="OK"
        else: results[name]="SEM URL: "+out[-250:].replace("\n"," ")
    except Exception as e:
        results[name]="ERRO: "+str(e)[:250]

if __name__=="__main__":
    ths=[threading.Thread(target=gen,args=(k,v)) for k,v in M.items()]
    [t.start() for t in ths]; [t.join() for t in ths]
    for k in M: print(k,"->",results.get(k,"?"))
