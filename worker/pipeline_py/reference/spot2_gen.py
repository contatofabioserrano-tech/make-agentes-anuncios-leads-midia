# -*- coding: utf-8 -*-
"""PROPAGANDA CINEMATOGRAFICA: iPhone 17 Pro Max laranja. Grok copy + NB2 4k stills + Seedance 2.0 + ElevenLabs."""
import json, urllib.request, os, re, subprocess, threading

for d in ("work_s","images_s","videos_s","vo_s"): os.makedirs(d, exist_ok=True)
env = {}
for ln in open(r"C:\Users\f.serrano\Downloads\fortuna-creative\worker\.env", encoding="utf-8"):
    if "=" in ln: k,v = ln.strip().split("=",1); env[k]=v

# ---------- 1. copy cinematica (Grok) ----------
payload = {
  "model": env.get("XAI_MODEL","grok-4.5"), "temperature": 0.75,
  "messages": [
    {"role":"system","content":"Voce escreve locucao de propaganda premium estilo Apple no Brasil: frases curtissimas, pausadas, elegantes, poderosas. Responda APENAS JSON valido, sem markdown."},
    {"role":"user","content":(
      "Propaganda cinematografica 35s da BR Mobile: ALUGUEL do iPhone 17 Pro Max LARANJA para empresas e eventos "
      "(frota sob medida, de 1 dia a frota permanente, entrega rapida em Sao Paulo, desde 2011). "
      "NUNCA diga que servicos sao gratis/incluidos. NUNCA use 'gratis' nem '24/7'. "
      'JSON: {"vo": ["..."]} — 6 frases pt-BR de 4-9 palavras, tom Apple: '
      "1 abertura sensorial sobre o produto na cor laranja; 2 nomeia iPhone 17 Pro Max na sua empresa sem compra; "
      "3 eventos e equipes; 4 frota sob medida com entrega rapida em SP; 5 'Por que comprar, se voce pode alugar?'; "
      "6 assinatura 'BR Mobile.' + 3 palavras de fechamento."
    )}
  ]
}
req = urllib.request.Request("https://api.x.ai/v1/chat/completions", data=json.dumps(payload).encode(), method="POST",
    headers={"Authorization":"Bearer "+env["XAI_API_KEY"], "Content-Type":"application/json"})
txt = json.load(urllib.request.urlopen(req, timeout=120))["choices"][0]["message"]["content"].strip()
txt = re.sub(r"^```(json)?|```$", "", txt, flags=re.M).strip()
copy = json.loads(txt)
json.dump(copy, open("work_s/copy.json","w",encoding="utf-8"), ensure_ascii=False, indent=1)
print("GROK:", " | ".join(copy["vo"][:3]))

# ---------- 2. cenas (DP format, produto: iPhone 17 Pro Max cosmic orange) ----------
PHONE = "cosmic orange titanium iPhone 17 Pro Max"
P = {
"s1_macro": f"CAMERA: IMAX MK IV 65mm, ISO 250, macro position ten centimeters from the device, low oblique angle across the camera module. LENS: Zeiss Makro-Planar 65mm T2.2, critical focus on the brushed titanium edge. LIGHT: single narrow orange-warm rim strip at 2.800K raking from camera-right, deep black studio void, edge highlights at 90 IRE, everything else falling under 8 IRE. SUBJECT: a {PHONE} suspended at a dramatic diagonal in a black studio void, camera module facing up, titanium texture and lens glass catching the rim light. FOREGROUND: soft out-of-focus reflection of the device on black acrylic below. MIDGROUND: the device edge and camera module, razor sharp. BACKGROUND: pure black falling to nothing. WARDROBE TONAL BEHAVIOR: brushed orange titanium with fine anisotropic grain, sapphire lens covers with tiny speculars. MAKEUP SURFACE PHYSICS: not applicable, real material physics, faint fingerprint-free sheen. POST BEHAVIOR: Kodak 2383 print emulation, visible tactile grain, strong halation on rim highlights, deep blacks, orange priority. COMPOSITIONAL GEOMETRY: device diagonal from lower-left to upper-right, negative black space dominating two thirds. MOOD & ART DIRECTION: Composition and art direction inspired in the work of award-winning directors.",
"s2_case": f"CAMERA: ARRI Alexa 35, ISO 800, low position at case height, shooting across the open flight case. LENS: Canon K35 55mm T1.5, sixty centimeters, focus on the phone being lifted. LIGHT: cool warehouse key at 5.000K from above, warm practical glow at 3.000K inside the case edge, hands at 65 IRE. SUBJECT: two hands in black microfiber gloves lifting one {PHONE} from a foam-lined flight case where six identical orange units remain seated in cut slots, warehouse depth behind. Intercepted framing, forearm crossing the lower corner. FOREGROUND: defocused case lid with metal latch catching a specular. MIDGROUND: the lifted phone and glove texture, sharp. BACKGROUND: logistics shelves in soft bokeh, one lime green accent stripe defocused. WARDROBE TONAL BEHAVIOR: matte gloves, charcoal foam absorbing light, orange titanium glowing against it. MAKEUP SURFACE PHYSICS: fabric weave visible on gloves, real foam texture. POST BEHAVIOR: Kodak Vision3 500T 5219, visible organic grain, mild halation, cool-warm split with orange priority. COMPOSITIONAL GEOMETRY: case diagonal, lifted phone at upper-right power point. MOOD & ART DIRECTION: Composition and art direction inspired in the work of award-winning directors.",
"s3_executivo": f"CAMERA: ARRI Alexa 35, ISO 800, hip-level tracking position beside the subject, slight low angle. LENS: Canon K35 35mm T1.5, one and a half meters, focus on the phone in hand. LIGHT: late daylight through a glass curtain wall at 5.200K camera-left, long soft shadows across polished concrete, face at 60 IRE with window rim. SUBJECT: a confident businesswoman in a tailored charcoal suit walking through a modern glass office corridor reading the screen of a {PHONE}, the orange titanium catching window light. Intercepted framing, glass mullions crossing the frame. FOREGROUND: defocused glass reflection sliding past. MIDGROUND: subject mid-stride, phone sharp. BACKGROUND: open office depth, people silhouettes in bokeh, city haze through glass. WARDROBE TONAL BEHAVIOR: matte wool suit, crisp white collar, orange device as the single color accent. MAKEUP SURFACE PHYSICS: real skin texture, subtle powder finish, no retouch. POST BEHAVIOR: Kodak Vision3 250D 5207, visible organic grain, clean highlight rolloff, neutral grade with orange accent priority. COMPOSITIONAL GEOMETRY: subject on right thirds walking left-to-right, leading space ahead, mullion rhythm vertical. MOOD & ART DIRECTION: Composition and art direction inspired in the work of award-winning directors.",
"s4_evento": f"CAMERA: ARRI Alexa 35, ISO 800, low position at podium height at a premium tech event entrance. LENS: Canon K35 55mm T1.5, eighty centimeters, focus on the phone scanning a badge. SUBJECT: an event hostess in a black dress scanning a guest QR badge with a {PHONE} at a velvet-rope entrance of a premium corporate event, warm bokeh wall of lights behind, guest in a navy blazer waiting. Intercepted framing. LIGHT: warm tungsten entrance glow at 3.200K on faces, cool blue event wash at 6.000K deep background, phone screen glow frontal, faces at 60 IRE. FOREGROUND: defocused velvet rope brass post catching speculars. MIDGROUND: the scan gesture, phone and badge sharp. BACKGROUND: dense golden bokeh of event lighting, silhouettes mingling. WARDROBE TONAL BEHAVIOR: black satin absorbing, brass warm speculars, orange titanium vivid. MAKEUP SURFACE PHYSICS: elegant evening makeup, real skin sheen under warm light. POST BEHAVIOR: Kodak Vision3 500T 5219, visible organic grain, strong halation on bokeh, warm-cool contrast. COMPOSITIONAL GEOMETRY: phone at center power point, rope diagonal lower-left, bokeh field upper two thirds. MOOD & ART DIRECTION: Composition and art direction inspired in the work of award-winning directors.",
"s5_frota": f"CAMERA: IMAX MK IV 65mm, ISO 250, low oblique position at bench height, shooting down the length of a prep line. LENS: Leica Summilux-C 40mm T1.4, one meter, focus on the third device in line. LIGHT: cool clean LED array at 5.000K overhead, even field, orange devices at 75 IRE, thin soft shadows. SUBJECT: a long prep bench with twenty {PHONE} units standing upright in a precise receding line, each screen showing the same welcome interface, a technician's hand adjusting the nearest one, scale and order. FOREGROUND: first two devices dissolving out of focus. MIDGROUND: the receding line, third to eighth units sharp. BACKGROUND: logistics room depth, shelf bokeh, graphite wall with a lime accent band defocused. WARDROBE TONAL BEHAVIOR: orange titanium repeating like a pattern, matte bench. MAKEUP SURFACE PHYSICS: real hand texture, short clean nails. POST BEHAVIOR: Kodak Vision3 250D 5207, visible organic grain, flat even field with deep perspective, orange priority. COMPOSITIONAL GEOMETRY: one-point perspective line receding to upper-left vanishing point, hand intruding lower-right. MOOD & ART DIRECTION: Composition and art direction inspired in the work of award-winning directors.",
"s6_golden": f"CAMERA: ARRI Alexa 35, ISO 800, low angle from waist height on a rooftop terrace at golden hour. LENS: Canon K35 35mm T1.5, one meter, focus on the subject's smile then the phone. SUBJECT: a young professional man in a light knit sweater leaning on a rooftop rail at golden hour, raising a {PHONE} slightly as he reads a confirmation on screen and smiles, city skyline soft behind. Intercepted framing, rail crossing the lower frame. LIGHT: low golden sun at 3.000K raking from camera-left, warm rim on hair and the orange titanium edge, face at 65 IRE, long shadows. FOREGROUND: defocused rail edge with warm speculars. MIDGROUND: subject and phone, sharp. BACKGROUND: city skyline in golden haze bokeh, birds distant. WARDROBE TONAL BEHAVIOR: soft knit catching warm light, orange device harmonizing with the sunset palette. MAKEUP SURFACE PHYSICS: real skin, squint lines, warm sheen on cheekbone. POST BEHAVIOR: Kodak Vision3 250D 5207, visible organic grain, gentle halation on the sun edge, golden midtone priority. COMPOSITIONAL GEOMETRY: subject right thirds, skyline band lower third, negative sky upper-left with sun flare intrusion. MOOD & ART DIRECTION: Composition and art direction inspired in the work of award-winning directors.",
}
M = {
"s1_macro": "Extremely slow macro orbit around the titanium edge and camera module, rim light sweeping across the brushed orange metal, faint dust motes drifting in the black void, reflections gliding on the acrylic below.",
"s2_case": "Slow push-in as the gloved hands lift the orange phone out of the foam slot and raise it toward camera, the remaining units settling in soft focus, warehouse light shifting gently.",
"s3_executivo": "Smooth lateral tracking with the businesswoman as she walks the glass corridor, window light strobing softly through mullions, she glances at the orange phone and ahead again, hair moving subtly.",
"s4_evento": "Steady push toward the scan moment, the phone screen flashes a confirmation, the hostess smiles and gestures the guest through, golden bokeh breathing behind, velvet rope swaying slightly.",
"s5_frota": "Slow dolly along the receding line of orange phones, screens lighting up in sequence as the camera passes, the technician's hand withdrawing, perspective deepening.",
"s6_golden": "Gentle rise and slow push as the man lifts the phone, sun flare sweeping across the lens, he smiles at the screen and looks to the skyline, breeze moving the knit sweater.",
}
def hf(cmd, timeout):
    return subprocess.check_output(cmd, stderr=subprocess.STDOUT, timeout=timeout).decode("utf-8", errors="replace")
def parse_url(out, ext):
    m = re.search(r'\{.*\}', out, re.S)
    j = json.loads(m.group(0)) if m else {}
    url = j.get("result_url") or (j.get("results") or [{}])[0].get("url") or j.get("url")
    if not url:
        urls = re.findall(r'https://\S+\.'+ext, out); url = urls[0] if urls else None
    return url
res={}
def gen_img(name):
    flat = re.sub(r"\s+"," ",P[name]).strip()
    try:
        out = hf(["cmd","/c","higgsfield","generate","create","nano_banana_2","--prompt",flat,
                  "--aspect_ratio","9:16","--resolution","4k","--wait","--wait-timeout","20m","--json"], 1300)
        url = parse_url(out, r'(?:png|jpg|jpeg|webp)')
        urllib.request.urlretrieve(url, f"images_s/{name}.png"); res[name]="img OK"
    except Exception as e: res[name]="img ERRO "+str(e)[:150]
ths=[threading.Thread(target=gen_img,args=(k,)) for k in P]
[t.start() for t in ths]; [t.join() for t in ths]
print(json.dumps(res, ensure_ascii=False))

def gen_vid(name):
    base=["cmd","/c","higgsfield","generate","create","seedance_2_0","--prompt",M[name],
          "--start-image",f"images_s/{name}.png","--wait","--wait-timeout","30m","--json"]
    for extra in (["--duration","5"], []):
        try:
            out = hf(base[:8]+extra+base[8:], 2100)
            url = parse_url(out, "mp4")
            if url:
                urllib.request.urlretrieve(url, f"videos_s/{name}.mp4"); res[name]+=" | vid OK"; return
        except Exception as e:
            err=str(e)[:150]
    res[name]+=" | vid ERRO "+err
ths=[threading.Thread(target=gen_vid,args=(k,)) for k in P if res.get(k,"").startswith("img OK")]
[t.start() for t in ths]; [t.join() for t in ths]

# ---------- VO ----------
for i, txt2 in enumerate(json.load(open("work_s/copy.json",encoding="utf-8"))["vo"], 1):
    try:
        body=json.dumps({"text":txt2,"model_id":"eleven_multilingual_v2","voice_settings":{"stability":0.55,"similarity_boost":0.8,"style":0.25}}).encode()
        rq=urllib.request.Request(f"https://api.elevenlabs.io/v1/text-to-speech/{env.get('ELEVENLABS_VOICE_ID','pNInz6obpgDQGcFmaJgB')}",
            data=body,method="POST",headers={"xi-api-key":env["ELEVENLABS_API_KEY"],"Content-Type":"application/json"})
        open(f"vo_s/vo{i}.mp3","wb").write(urllib.request.urlopen(rq,timeout=120).read())
        res[f"vo{i}"]="OK"
    except Exception as e: res[f"vo{i}"]="ERRO "+str(e)[:100]
for k in list(P)+[f"vo{i}" for i in range(1,7)]: print(k,"->",res.get(k))
