# -*- coding: utf-8 -*-
"""PROPAGANDA CAPTACAO PRATIQUE BOXE: Grok copy + 5 cenas NB2 4k + cena REAL do Caio + Seedance + VO."""
import json, urllib.request, os, re, subprocess, threading
from PIL import Image, ImageFilter

for d in ("work_p","images_p","videos_p","vo_p"): os.makedirs(d, exist_ok=True)
env = {}
for ln in open(r"C:\Users\f.serrano\Downloads\fortuna-creative\worker\.env", encoding="utf-8"):
    if "=" in ln: k,v = ln.strip().split("=",1); env[k]=v

# ---------- cena real do Caio: crop do card -> canvas 9:16 ----------
card = Image.open(r"C:\Users\f.serrano\Downloads\pratique-boxe-branding\caio\WhatsApp Image 2026-07-26 at 00.07.55.jpeg").convert("RGB")
cw,ch = card.size
foto = card.crop((0,0,int(cw*0.44),int(ch*0.99)))
CW,CH = 1536,2752
bg = foto.resize((CW,int(foto.height*CW/foto.width)), Image.LANCZOS).filter(ImageFilter.GaussianBlur(40)).crop((0,0,CW,CH)) if foto.height*CW/foto.width>=CH else None
canvas = Image.new("RGB",(CW,CH),(13,13,13))
if bg: canvas.paste(bg,(0,0))
ratio = min(CW/foto.width, CH/foto.height)
f2 = foto.resize((int(foto.width*ratio),int(foto.height*ratio)), Image.LANCZOS)
canvas.paste(f2, ((CW-f2.width)//2,(CH-f2.height)//2))
canvas.save("images_p/b3_caio.png")
print("cena caio ok", canvas.size)

# ---------- copy Grok ----------
payload = {
  "model": env.get("XAI_MODEL","grok-4.5"), "temperature": 0.8,
  "messages": [
    {"role":"system","content":"Voce escreve locucao de propaganda de academia de luta no Brasil: frases curtas, energicas, diretas, que desafiam o espectador sem clichê. Responda APENAS JSON valido, sem markdown."},
    {"role":"user","content":(
      "Propaganda 35s de CAPTACAO DE ALUNOS da PRATIQUE BOXE (equipe de boxe e muay-thai, lema 'Disciplina, respeito, foco e evolucao'). "
      "Professor: Caio Serrano, professor de boxe e mestre de muay-thai. Publico: iniciantes e quem quer evoluir. "
      'JSON: {"vo": ["..."]} — 6 frases pt-BR de 4-9 palavras: '
      "1 hook desafiador sobre comecar; 2 o que o boxe entrega (foco/disciplina/confianca); "
      "3 apresenta o professor Caio Serrano mestre de muay-thai; 4 acolhe o iniciante que nunca treinou; "
      "5 energia de equipe e evolucao; 6 CTA 'Agende sua aula experimental' + assinatura Pratique Boxe."
    )}
  ]
}
req = urllib.request.Request("https://api.x.ai/v1/chat/completions", data=json.dumps(payload).encode(), method="POST",
    headers={"Authorization":"Bearer "+env["XAI_API_KEY"], "Content-Type":"application/json"})
txt = json.load(urllib.request.urlopen(req, timeout=120))["choices"][0]["message"]["content"].strip()
txt = re.sub(r"^```(json)?|```$", "", txt, flags=re.M).strip()
copy = json.loads(txt)
json.dump(copy, open("work_p/copy.json","w",encoding="utf-8"), ensure_ascii=False, indent=1)
print("GROK:", " | ".join(copy["vo"][:2]))

P = {
"b1_luvas": "CAMERA: IMAX MK IV 65mm, ISO 250, macro position thirty centimeters from the hands, low oblique angle. LENS: Zeiss Makro-Planar 65mm T2.2, critical focus on the wrapping gauze. SUBJECT: a fighter's hands being wrapped in black boxing hand wraps, one loop pulled tight, a pair of worn red boxing gloves waiting on the bench below, chalk dust drifting. LIGHT: single hard tungsten key at 3.000K raking from camera-left, deep gym darkness behind, knuckle highlights at 85 IRE, shadows at 10 IRE. FOREGROUND: defocused red glove cuff lower-left. MIDGROUND: the hands and wrap, razor sharp. BACKGROUND: dark gym falling to black, one caged bulb as bokeh. WARDROBE TONAL BEHAVIOR: matte wraps, scuffed red leather with satin speculars. MAKEUP SURFACE PHYSICS: real skin, scarred knuckles, veins, chalk residue. POST BEHAVIOR: Kodak Vision3 500T 5219, visible heavy organic grain, halation on the bulb, red priority. COMPOSITIONAL GEOMETRY: hands diagonal, negative dark space right third. MOOD & ART DIRECTION: Composition and art direction inspired in the work of award-winning directors.",
"b2_saco": "CAMERA: ARRI Alexa 35, ISO 800, low position at waist height beside a heavy bag. LENS: Canon K35 35mm T1.5, one meter, focus on the impact. SUBJECT: a fighter in a black Pratique Boxe tank top driving a hook into a heavy bag, sweat spray frozen mid-air off the shoulder, bag folding at the impact point, chains taut. LIGHT: hard backlight at 4.000K from behind the bag creating a rim silhouette, weak warm fill camera-right, sweat particles catching the backlight at 95 IRE. FOREGROUND: defocused second heavy bag edge. MIDGROUND: the impact, fist and bag fold sharp. BACKGROUND: dark gym depth, ring ropes faint, red wall band barely readable. WARDROBE TONAL BEHAVIOR: soaked black fabric, red glove leather glowing in rim light. MAKEUP SURFACE PHYSICS: real sweat sheen, tensed muscle definition, gritted jaw. POST BEHAVIOR: Kodak Vision3 500T 5219, visible heavy grain, strong halation on sweat spray, deep contrast. COMPOSITIONAL GEOMETRY: fist at right-third power point, chain diagonal upper-left, spray arc crossing the frame. MOOD & ART DIRECTION: Composition and art direction inspired in the work of award-winning directors.",
"b4_aula": "CAMERA: ARRI Alexa 35, ISO 800, hip-level position on the gym floor mats. LENS: Canon K35 55mm T1.5, one meter, focus on the coach's correcting hands. SUBJECT: a patient coach in a black team shirt adjusting the guard position of a nervous beginner in training gloves, gentle correction of the elbow, encouraging nod, other students drilling in soft depth. LIGHT: warm practical gym lights at 3.400K overhead pools, faces at 60 IRE, honest unglamorous gym light. FOREGROUND: defocused edge of a folded towel and water bottle on the mat. MIDGROUND: the correction moment, hands and guard sharp. BACKGROUND: students drilling in bokeh, red heavy bags line the wall. WARDROBE TONAL BEHAVIOR: matte team blacks, white beginner tee, red gloves accent. MAKEUP SURFACE PHYSICS: real skin, light first-class sweat, genuine expressions. POST BEHAVIOR: Kodak Vision3 250D 5207, visible organic grain, warm honest grade, red accents. COMPOSITIONAL GEOMETRY: coach left third, beginner right third, guard hands meeting center. MOOD & ART DIRECTION: Composition and art direction inspired in the work of award-winning directors.",
"b5_ringue": "CAMERA: ARRI Alexa 35, ISO 800, low angle from the ring apron shooting through the ropes. LENS: Canon K35 35mm T1.5, two meters, focus on the sparring exchange. SUBJECT: two fighters in headgear sparring in a boxing ring, one slipping a jab with a tight roll, coach leaning on the ropes shouting instruction, dust motes in the light column. LIGHT: hard cold ring light from above at 5.000K like a fight night, bodies at 70 IRE, corners falling dark, red corner pad glowing. FOREGROUND: defocused ring rope crossing the frame diagonally. MIDGROUND: the exchange, slip motion sharp. BACKGROUND: dark gym, team watching as silhouettes, red wall band. WARDROBE TONAL BEHAVIOR: sweat-dark shirts, red headgear and gloves saturated under the top light. MAKEUP SURFACE PHYSICS: heavy honest sweat, focused eyes under headgear. POST BEHAVIOR: Kodak Vision3 500T 5219, visible heavy grain, halation on the top light, gritty contrast. COMPOSITIONAL GEOMETRY: fighters on crossing diagonals, rope leading line lower-left, coach silhouette right edge. MOOD & ART DIRECTION: Composition and art direction inspired in the work of award-winning directors.",
"b6_golden": "CAMERA: ARRI Alexa 35, ISO 800, waist-level position by the gym's open side door at sunset. LENS: Canon K35 35mm T1.5, one meter, focus on the tired smile. SUBJECT: a beginner student sitting on the ring edge after her first class, gloves still on, forearms on knees, head tilting up with an exhausted proud smile, golden hour light flooding through the door, coach's fist offered for a bump at frame edge. LIGHT: low golden sun at 3.000K raking through the door, dust in the beam, face at 65 IRE with warm rim, gym falling to warm dark. FOREGROUND: defocused glove of the offered fist bump entering from the right. MIDGROUND: her face and gloves, sharp. BACKGROUND: ring ropes and heavy bags in golden haze. WARDROBE TONAL BEHAVIOR: soaked tee, red gloves warm in the sun. MAKEUP SURFACE PHYSICS: real exhausted glow, flushed cheeks, loose hair strands backlit. POST BEHAVIOR: Kodak Vision3 250D 5207, visible organic grain, gentle halation on the beam, golden priority. COMPOSITIONAL GEOMETRY: subject left thirds, light beam diagonal, fist intruding right edge. MOOD & ART DIRECTION: Composition and art direction inspired in the work of award-winning directors.",
}
M = {
"b1_luvas": "Extremely slow macro push as the hand wrap pulls tight around the knuckles, chalk dust drifting through the hard light, the red gloves below settling.",
"b2_saco": "The fighter drives the hook into the heavy bag, sweat spray bursting through the backlight, bag swinging on taut chains, he resets his guard breathing hard.",
"b3_caio": "Subtle confident motion: the coach nods slightly and tightens his raised fist, natural breathing, gym light steady, gentle handheld micro-movement, face unchanged.",
"b4_aula": "Slow push-in as the coach gently adjusts the beginner's elbow and nods approval, the student settles into a proper guard and smiles briefly, students drilling behind.",
"b5_ringue": "Dynamic but short: one fighter slips the jab with a tight roll and answers with a counter touch, the coach slaps the rope shouting encouragement, dust drifting in the light.",
"b6_golden": "Gentle push as she lifts her head with the exhausted smile and bumps the offered glove, dust floating in the golden beam, her shoulders dropping in relief.",
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
        urllib.request.urlretrieve(url, f"images_p/{name}.png"); res[name]="img OK"
    except Exception as e: res[name]="img ERRO "+str(e)[:150]
ths=[threading.Thread(target=gen_img,args=(k,)) for k in P]
[t.start() for t in ths]; [t.join() for t in ths]
res["b3_caio"]="img OK (real)"
print(json.dumps(res, ensure_ascii=False))

ALL = list(P.keys())+["b3_caio"]
def gen_vid(name):
    err="?"
    base=["cmd","/c","higgsfield","generate","create","seedance_2_0","--prompt",M[name],
          "--start-image",f"images_p/{name}.png","--wait","--wait-timeout","30m","--json"]
    for extra in (["--duration","5"], []):
        try:
            out = hf(base[:8]+extra+base[8:], 2100)
            url = parse_url(out, "mp4")
            if url:
                urllib.request.urlretrieve(url, f"videos_p/{name}.mp4"); res[name]=res.get(name,"")+" | vid OK"; return
        except Exception as e: err=str(e)[:150]
    res[name]=res.get(name,"")+" | vid ERRO "+err
ths=[threading.Thread(target=gen_vid,args=(k,)) for k in ALL if res.get(k,"").startswith("img OK")]
[t.start() for t in ths]; [t.join() for t in ths]

for i, t2 in enumerate(json.load(open("work_p/copy.json",encoding="utf-8"))["vo"], 1):
    try:
        body=json.dumps({"text":t2,"model_id":"eleven_multilingual_v2","voice_settings":{"stability":0.42,"similarity_boost":0.8,"style":0.45}}).encode()
        rq=urllib.request.Request(f"https://api.elevenlabs.io/v1/text-to-speech/{env.get('ELEVENLABS_VOICE_ID','pNInz6obpgDQGcFmaJgB')}",
            data=body,method="POST",headers={"xi-api-key":env["ELEVENLABS_API_KEY"],"Content-Type":"application/json"})
        open(f"vo_p/vo{i}.mp3","wb").write(urllib.request.urlopen(rq,timeout=120).read())
        res[f"vo{i}"]="OK"
    except Exception as e: res[f"vo{i}"]="ERRO "+str(e)[:100]
for k in ALL+[f"vo{i}" for i in range(1,7)]: print(k,"->",res.get(k))
