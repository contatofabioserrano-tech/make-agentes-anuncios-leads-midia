# -*- coding: utf-8 -*-
"""PROPAGANDA LAVIH SPA: copy Grok + 6 cenas NB2 4k + Seedance 2.0 + VO feminina ElevenLabs."""
import json, urllib.request, os, re, subprocess, threading

for d in ("work_l","images_l","videos_l","vo_l"): os.makedirs(d, exist_ok=True)
env = {}
for ln in open(r"C:\Users\f.serrano\Downloads\fortuna-creative\worker\.env", encoding="utf-8"):
    if "=" in ln: k,v = ln.strip().split("=",1); env[k]=v

payload = {
  "model": env.get("XAI_MODEL","grok-4.5"), "temperature": 0.75,
  "messages": [
    {"role":"system","content":"Voce escreve locucao de propaganda premium de spa no Brasil: frases curtas, calmas, sensoriais, elegantes. Responda APENAS JSON valido, sem markdown."},
    {"role":"user","content":(
      "Propaganda cinematografica 35s do LAVIH Spa (lavihspa.com.br, 'Seu refugio de bem-estar', desde 2023, unidades em varias cidades). "
      "Servicos REAIS a citar: Head Spa Harmonia Total; Drenagem Linfatica Sensorial; Ritual das Pedras Quentes; e o Vale-Spa (presente). "
      "NAO cite precos. NAO invente servicos. "
      'JSON: {"vo": ["..."]} — 6 frases pt-BR de 5-10 palavras, tom sensorial-elegante: '
      "1 convite a desacelerar; 2 apresenta o Head Spa Harmonia Total; 3 Drenagem Linfatica Sensorial; "
      "4 Ritual das Pedras Quentes; 5 'autocuidado e necessidade, nao luxo' + Vale-Spa de presente; "
      "6 assinatura 'Lavih Spa. Seu refugio de bem-estar.'"
    )}
  ]
}
req = urllib.request.Request("https://api.x.ai/v1/chat/completions", data=json.dumps(payload).encode(), method="POST",
    headers={"Authorization":"Bearer "+env["XAI_API_KEY"], "Content-Type":"application/json"})
txt = json.load(urllib.request.urlopen(req, timeout=120))["choices"][0]["message"]["content"].strip()
txt = re.sub(r"^```(json)?|```$", "", txt, flags=re.M).strip()
copy = json.loads(txt)
json.dump(copy, open("work_l/copy.json","w",encoding="utf-8"), ensure_ascii=False, indent=1)
print("GROK:", " | ".join(copy["vo"][:2]))

P = {
"l1_agua": "CAMERA: IMAX MK IV 65mm, ISO 250, macro position twenty centimeters above a dark ceramic head spa basin. LENS: Zeiss Makro-Planar 65mm T2.2, critical focus on the water stream meeting dark hair. SUBJECT: warm water cascading in a smooth ribbon over long dark hair spread in a head spa basin, fine steam rising, droplets catching golden light like beads. LIGHT: single warm key at 2.700K camera-left mimicking candlelight, soft golden kicker on the steam, water highlights at 85 IRE, deep soft shadows at 15 IRE. FOREGROUND: defocused rim of the ceramic basin. MIDGROUND: the water ribbon and hair, razor sharp. BACKGROUND: warm beige wall falling to soft darkness, one candle flame as bokeh. WARDROBE TONAL BEHAVIOR: wet hair glossy with amber speculars. MAKEUP SURFACE PHYSICS: not applicable, real water physics, micro droplets suspended. POST BEHAVIOR: Kodak Vision3 500T 5219, visible organic grain, gentle halation on the candle and water highlights, warm golden midtone priority. COMPOSITIONAL GEOMETRY: water ribbon diagonal upper-left to lower-right, negative warm space on the right third. MOOD & ART DIRECTION: Composition and art direction inspired in the work of award-winning directors.",
"l2_headspa": "CAMERA: ARRI Alexa 35, ISO 800, low position beside the head spa chair, slight high angle on the face. LENS: Canon K35 55mm T1.5, seventy centimeters, focus on the closed eyes. SUBJECT: a woman reclined in a head spa chair with serene closed eyes, a therapist's hands in gentle scalp massage, warm beige linens, gold-trimmed details, candles in soft depth. Intercepted framing, therapist forearm crossing the upper corner. LIGHT: warm practical candlelight pools at 2.600K, soft top fill at 3.200K, face at 55 IRE with golden wrap, background falling warm-dark. FOREGROUND: defocused eucalyptus sprig in a ceramic vase. MIDGROUND: her face and the massaging hands, sharp. BACKGROUND: beige spa wall with a thin brass line detail, candle bokeh. WARDROBE TONAL BEHAVIOR: cream towel turban, soft robe, skin with warm satin sheen. MAKEUP SURFACE PHYSICS: real skin texture, dewy hydrated glow, relaxed micro-expressions. POST BEHAVIOR: Kodak Vision3 250D 5207, visible organic grain, creamy highlight rolloff, golden beige priority. COMPOSITIONAL GEOMETRY: face on left thirds, hands entering from above, candle bokeh field right. MOOD & ART DIRECTION: Composition and art direction inspired in the work of award-winning directors.",
"l3_pedras": "CAMERA: IMAX MK IV 65mm, ISO 250, low oblique position at table height along a bare back. LENS: Zeiss Makro-Planar 65mm T2.2, fifty centimeters, focus on the first basalt stone. SUBJECT: a therapist's hands placing smooth black basalt stones in a line along a woman's bare back, faint steam rising from the stones, oiled skin glowing, warm towels framing. LIGHT: low warm raking light at 2.800K from camera-right, stone highlights at 80 IRE, skin at 60 IRE with long soft shadows between stones. FOREGROUND: defocused folded cream towel edge. MIDGROUND: the stone line and hands, sharp. BACKGROUND: warm beige depth, a brass bowl catching a glint. WARDROBE TONAL BEHAVIOR: matte black stones with wet-look tops, oiled skin satin. MAKEUP SURFACE PHYSICS: real skin texture with fine oil sheen, gentle muscle relief. POST BEHAVIOR: Kodak 2383 print emulation, visible tactile grain, warm contrast, golden priority. COMPOSITIONAL GEOMETRY: stone line receding diagonal, hands at the golden point. MOOD & ART DIRECTION: Composition and art direction inspired in the work of award-winning directors.",
"l4_drenagem": "CAMERA: ARRI Alexa 35, ISO 800, close position at massage table height. LENS: Canon K35 55mm T1.5, sixty centimeters, focus on the gliding hands. SUBJECT: a therapist's hands in a slow lymphatic drainage glide along a woman's calf and leg, skin glistening with aromatic oil, warm towel rolls framing, a drop of oil stretching from a glass dropper in the foreground. LIGHT: soft warm wrap at 3.000K, oil highlights at 85 IRE, skin at 60 IRE, dark warm falloff. FOREGROUND: glass oil dropper defocused with a golden drop. MIDGROUND: the gliding hands, sharp. BACKGROUND: beige linen depth, candle flame bokeh. WARDROBE TONAL BEHAVIOR: oiled skin satin, cream linens matte. MAKEUP SURFACE PHYSICS: real skin with oil micro-sheen, gentle pressure marks appearing and fading. POST BEHAVIOR: Kodak Vision3 500T 5219, visible organic grain, halation on oil speculars, warm golden priority. COMPOSITIONAL GEOMETRY: leg diagonal, hands mid-frame, dropper intruding lower-left. MOOD & ART DIRECTION: Composition and art direction inspired in the work of award-winning directors.",
"l5_ambiente": "CAMERA: ARRI Alexa 35, ISO 800, low dolly position at knee height entering a spa suite. LENS: Canon K35 35mm T1.5, deep set focus mid-room. SUBJECT: a serene spa suite in beige and gold: a made massage bed with cream linens, lit candles clustered on a wooden tray, folded towels with a gold ribbon, an orchid, soft steam drifting from a bowl of hot water. LIGHT: layered warm practicals at 2.600-3.000K, pools of candlelight, walls at 45 IRE, flames at 95 IRE with halation. FOREGROUND: defocused candle flames lower-left. MIDGROUND: the bed and tray, sharp. BACKGROUND: arch to a darker relaxation corner, brass sconce glint. WARDROBE TONAL BEHAVIOR: linen matte, brass and gold trims specular, wood warm. MAKEUP SURFACE PHYSICS: not applicable, real textures of linen, wax and steam. POST BEHAVIOR: Kodak Vision3 500T 5219, visible organic grain, strong candle halation, golden beige priority. COMPOSITIONAL GEOMETRY: bed diagonal from lower-right, candle cluster on left third, steam rising through the upper third. MOOD & ART DIRECTION: Composition and art direction inspired in the work of award-winning directors.",
"l6_saida": "CAMERA: ARRI Alexa 35, ISO 800, waist-level position by a warm window. LENS: Canon K35 35mm T1.5, one meter, focus on her softened smile. SUBJECT: a woman in a cream spa robe and towel turban by a sheer-curtained window after her session, holding a warm cup of tea with both hands, eyes softly closed in a content smile, skin luminous. Intercepted framing, curtain edge crossing the left frame. LIGHT: diffused golden window light at 3.400K wrapping the face at 65 IRE, steam from the cup catching the beam, warm falloff behind. FOREGROUND: defocused sheer curtain with glowing edge. MIDGROUND: her face and the cup, sharp. BACKGROUND: soft beige suite depth, candle bokeh. WARDROBE TONAL BEHAVIOR: plush robe texture, ceramic cup matte with steam. MAKEUP SURFACE PHYSICS: real hydrated skin, post-treatment glow, no retouch. POST BEHAVIOR: Kodak Vision3 250D 5207, visible organic grain, gentle window halation, golden priority. COMPOSITIONAL GEOMETRY: face on right thirds, window light band diagonal, steam thread rising center. MOOD & ART DIRECTION: Composition and art direction inspired in the work of award-winning directors.",
}
M = {
"l1_agua": "Extremely slow macro push along the water ribbon as it flows over the dark hair, steam curling upward through the golden beam, droplets sliding, candle bokeh breathing softly.",
"l2_headspa": "Slow gentle arc around her serene face as the therapist's fingers work in circular scalp movements, candlelight flickering softly, steam drifting, her chest rising in a calm breath.",
"l3_pedras": "Slow lateral dolly along the line of stones as the hands place the final stone, faint steam rising from each, oil sheen shifting with the light, towels settling.",
"l4_drenagem": "Slow rhythmic glide of the hands along the leg in one continuous drainage stroke, oil catching light as it moves, the golden drop falling from the dropper in the foreground.",
"l5_ambiente": "Slow floating dolly into the suite, candle flames flickering, steam drifting from the bowl, the orchid trembling almost imperceptibly, warm light pools breathing.",
"l6_saida": "Gentle push-in as she lifts the tea and breathes in the steam, smile deepening, sheer curtain swaying in a soft draft, window light blooming across her face.",
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
        urllib.request.urlretrieve(url, f"images_l/{name}.png"); res[name]="img OK"
    except Exception as e: res[name]="img ERRO "+str(e)[:150]
ths=[threading.Thread(target=gen_img,args=(k,)) for k in P]
[t.start() for t in ths]; [t.join() for t in ths]
print(json.dumps(res, ensure_ascii=False))

def gen_vid(name):
    err="?"
    base=["cmd","/c","higgsfield","generate","create","seedance_2_0","--prompt",M[name],
          "--start-image",f"images_l/{name}.png","--wait","--wait-timeout","30m","--json"]
    for extra in (["--duration","5"], []):
        try:
            out = hf(base[:8]+extra+base[8:], 2100)
            url = parse_url(out, "mp4")
            if url:
                urllib.request.urlretrieve(url, f"videos_l/{name}.mp4"); res[name]+=" | vid OK"; return
        except Exception as e: err=str(e)[:150]
    res[name]+=" | vid ERRO "+err
ths=[threading.Thread(target=gen_vid,args=(k,)) for k in P if res.get(k,"").startswith("img OK")]
[t.start() for t in ths]; [t.join() for t in ths]

VOICE_F = "21m00Tcm4TlvDq8ikWAM"  # Rachel — feminina suave, multilingual
for i, t2 in enumerate(json.load(open("work_l/copy.json",encoding="utf-8"))["vo"], 1):
    try:
        body=json.dumps({"text":t2,"model_id":"eleven_multilingual_v2","voice_settings":{"stability":0.6,"similarity_boost":0.8,"style":0.2}}).encode()
        rq=urllib.request.Request(f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_F}",
            data=body,method="POST",headers={"xi-api-key":env["ELEVENLABS_API_KEY"],"Content-Type":"application/json"})
        open(f"vo_l/vo{i}.mp3","wb").write(urllib.request.urlopen(rq,timeout=120).read())
        res[f"vo{i}"]="OK"
    except Exception as e: res[f"vo{i}"]="ERRO "+str(e)[:100]
for k in list(P)+[f"vo{i}" for i in range(1,7)]: print(k,"->",res.get(k))
