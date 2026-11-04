# -*- coding: utf-8 -*-
"""PROVADO: geracao de imagens nano_banana_2 (prompts single-line + cmd /c). P = dict nome->prompt DP."""
import subprocess, json, os, threading, urllib.request, re

# Prompts no formato de DP (exemplo real que gerou o comercial — 1 dos 5):
P = {}
P["s1_hook"] = """CAMERA: ARRI Alexa 35, ISO 800, hip-level position slightly below the subject, tilted up a few degrees from armchair height.
LENS: Canon K35 35mm T1.5, one meter from subject, focus on the bird's head, shallow breathing field.
LIGHT: single practical table lamp at 2.900K camera-left, half a meter away, hard falloff into deep shadow camera-right, zero fill, shadows near 10 IRE, feather highlights near 70 IRE.
SUBJECT: a woman in her thirties seated at night holding a pale grey cockatiel close to her chest, head bowed toward the bird, brow tense, fingers gently cupped around its wings. Intercepted framing, her shoulder crossing the lower frame edge.
FOREGROUND: blurred edge of a dark green knit blanket dissolving out of focus.
MIDGROUND: woman and bird, focus locked on the crest feathers.
BACKGROUND: dark living room falling to black, one out-of-focus window with distant sodium streetlight bokeh.
WARDROBE TONAL BEHAVIOR: deep forest green cotton sweater absorbing lamp light, no sheen.
MAKEUP SURFACE PHYSICS: real skin texture, visible pores, slight oil on the nose bridge, no retouching.
POST BEHAVIOR: Kodak Vision3 500T 5219, visible organic grain, mild halation around the lamp, lifted blacks, warm midtone priority.
COMPOSITIONAL GEOMETRY: subject weighted to left third, dark negative space right, broken thirds, lamp intruding top-left.
MOOD & ART DIRECTION: Composition and art direction inspired in the work of award-winning directors."""

os.makedirs("images2",exist_ok=True)
results={}
def gen(name,prompt):
    flat = re.sub(r"\s*\n\s*"," ",prompt).strip()          # LINHA UNICA — obrigatorio
    cmd = ["cmd","/c","higgsfield","generate","create","nano_banana_2",
           "--prompt",flat,"--aspect_ratio","9:16","--resolution","2k",
           "--wait","--wait-timeout","15m","--json"]        # LISTA + cmd /c — obrigatorio
    try:
        out = subprocess.check_output(cmd, stderr=subprocess.STDOUT, timeout=1000).decode("utf-8",errors="replace")
        m = re.search(r'\{.*\}', out, re.S)
        j = json.loads(m.group(0)) if m else {}
        url = j.get("result_url") or (j.get("results") or [{}])[0].get("url") or j.get("url")
        if not url:
            urls = re.findall(r'https://\S+\.(?:png|jpg|jpeg|webp)', out)
            url = urls[0] if urls else None
        if url:
            urllib.request.urlretrieve(url, f"images2/{name}.png")
            results[name]="OK"
        else:
            results[name]="SEM URL: "+out[-300:].replace("\n"," ")
    except Exception as e:
        results[name]="ERRO: "+str(e)[:200]

if __name__=="__main__":
    ths=[threading.Thread(target=gen,args=(k,v)) for k,v in P.items()]
    [t.start() for t in ths]; [t.join() for t in ths]
    for k in P: print(k,"->",results.get(k,"?"))
