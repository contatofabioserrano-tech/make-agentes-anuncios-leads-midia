# -*- coding: utf-8 -*-
"""Áudio: locução pt-BR (ElevenLabs REST -> fallback edge-tts), trilha (arquivo em
worker/assets/music/ ou synth numpy PROVADO do prep_assets.py) e SFX whoosh dos sweeps."""
import json
import os
import wave

import numpy as np

from fc_common import FF, MUSIC_DIR, run

DEFAULT_VOICE = "pNInz6obpgDQGcFmaJgB"


# ---------------------------------------------------------------- locução
def _tts_elevenlabs(lines, outdir, voice=None, settings=None):
    import urllib.request
    key = os.environ["ELEVENLABS_API_KEY"]
    voice = voice or os.environ.get("ELEVENLABS_VOICE_ID") or DEFAULT_VOICE
    for k, txt in lines.items():
        payload = {"text": txt, "model_id": "eleven_multilingual_v2"}
        if settings:
            payload["voice_settings"] = settings
        body = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            "https://api.elevenlabs.io/v1/text-to-speech/" + voice,
            data=body,
            headers={"xi-api-key": key, "Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=120) as r:
            audio = r.read()
        with open(os.path.join(outdir, k + ".mp3"), "wb") as f:
            f.write(audio)
        print("[tts] elevenlabs %s ok" % k, flush=True)


def _tts_edge(lines, outdir, edge_voice="pt-BR-FranciscaNeural"):
    import asyncio
    import edge_tts

    async def go():
        for k, txt in lines.items():
            c = edge_tts.Communicate(txt, edge_voice, rate="-4%")
            await c.save(os.path.join(outdir, k + ".mp3"))
            print("[tts] edge %s ok" % k, flush=True)

    asyncio.run(go())


def tts(lines, outdir="vo", voice=None, edge_voice="pt-BR-FranciscaNeural", settings=None):
    """Gera vo/<k>.mp3 pra cada linha. ElevenLabs se houver key (voz opcional por
    parâmetro — tom do briefing decide masculina/feminina), senão edge-tts."""
    os.makedirs(outdir, exist_ok=True)
    if os.environ.get("ELEVENLABS_API_KEY"):
        try:
            _tts_elevenlabs(lines, outdir, voice, settings)
            return "elevenlabs"
        except Exception as e:
            print("[tts] ElevenLabs falhou (%s) — fallback edge-tts" % str(e)[:120], flush=True)
    _tts_edge(lines, outdir, edge_voice)
    return "edge-tts"


# ---------------------------------------------------------------- trilha
def _pick_music_file():
    if not os.path.isdir(MUSIC_DIR):
        return None
    exts = (".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg")
    files = sorted(f for f in os.listdir(MUSIC_DIR) if f.lower().endswith(exts))
    return os.path.join(MUSIC_DIR, files[0]) if files else None


def synth_music(dur_s, cta_t, out_wav):
    """Trilha upbeat sintetizada — port PROVADO do prep_assets.py (104 BPM, C-G-Am-F),
    parametrizada por duração e instante do CTA (riser + impacto)."""
    SR = 44100
    DUR = float(dur_s)
    N = int(SR * DUR)
    BPM = 104
    beat = 60 / BPM
    bar = 4 * beat
    prog = [(261.63, [261.63, 329.63, 392.00]), (196.00, [246.94, 293.66, 392.00]),
            (220.00, [261.63, 329.63, 440.00]), (174.61, [220.00, 261.63, 349.23])]
    L = np.zeros(N)
    R = np.zeros(N)

    def env(n, a, r, sus=1.0):
        e = np.full(n, sus)
        ai, ri = int(a * SR), int(r * SR)
        if ai > 0:
            e[:ai] = np.linspace(0, sus, ai)
        if ri > 0:
            e[-ri:] = np.linspace(sus, 0, ri)
        return e

    def pluck(f, dsec):
        n = int(dsec * SR)
        t = np.arange(n) / SR
        s = np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * 2 * f * t) + 0.22 * np.sin(2 * np.pi * 3 * f * t)
        return s * np.exp(-t / 0.16) * (1 - np.exp(-t / 0.004))

    def kick(dsec=0.16):
        n = int(dsec * SR)
        t = np.arange(n) / SR
        return np.sin(2 * np.pi * (120 * np.exp(-t * 26) + 42) * t) * np.exp(-t / 0.075)

    def clap(dsec=0.11):
        n = int(dsec * SR)
        x = np.random.randn(n)
        return np.convolve(x, np.ones(6) / 6, mode="same") * np.exp(-np.arange(n) / (0.035 * SR))

    def put(A, p, s):
        if p >= N or p < 0:
            return
        e = min(N, p + len(s))
        A[p:e] += s[:e - p]

    tt = 0.0
    bi = 0
    while tt < DUR - 0.1:
        bass, chord = prog[bi % 4]
        p0 = int(tt * SR)
        nb = int(bar * SR)
        tb = np.arange(min(nb, N - p0)) / SR
        pad = sum(np.sin(2 * np.pi * f * tb) + 0.3 * np.sin(2 * np.pi * f * 2.003 * tb) for f in chord) / len(chord)
        pad *= env(len(tb), 0.5, 0.5, 0.16)
        L[p0:p0 + len(tb)] += pad * 0.9
        R[p0:p0 + len(tb)] += pad * 0.9
        for e8 in range(8):
            st = tt + e8 * beat / 2
            if st >= DUR - 0.3:
                break
            f = chord[e8 % 3] * (2 if e8 % 4 in (1, 3) else 1)
            s = pluck(f, 0.30) * 0.24
            p = int(st * SR)
            put(L if e8 % 2 == 0 else R, p, s)
            bl = np.sin(2 * np.pi * bass * np.arange(int(beat / 2 * SR)) / SR) * \
                np.exp(-np.arange(int(beat / 2 * SR)) / (0.14 * SR)) * 0.30
            put(L, p, bl)
            put(R, p, bl)
        if bi >= 2:
            for b4 in range(4):
                p = int((tt + b4 * beat) * SR)
                k = kick() * 0.5
                put(L, p, k)
                put(R, p, k)
        if bi >= 4:
            for b4 in (1, 3):
                p = int((tt + b4 * beat) * SR)
                c = clap() * 0.20
                put(L, p, c)
                put(R, p, c)
        tt += bar
        bi += 1

    # riser terminando no CTA + impacto no CTA
    rn = int(2.0 * SR)
    rx = np.random.randn(rn)
    rx = np.convolve(rx, np.ones(10) / 10, mode="same") * ((np.arange(rn) / rn) ** 2.4) * 0.5
    put(L, int((cta_t - 2.05) * SR), rx)
    put(R, int((cta_t - 2.05) * SR), rx)
    imp = kick(0.5) * 1.1
    put(L, int((cta_t + 0.05) * SR), imp)
    put(R, int((cta_t + 0.05) * SR), imp)

    mix = np.stack([L, R], axis=1)
    sw = np.linspace(0.75, 1.0, N)[:, None]
    mix *= sw
    fi, fo = int(0.6 * SR), int(min(2.8, max(0.5, DUR / 3)) * SR)
    mix[:fi] *= np.linspace(0, 1, fi)[:, None]
    mix[-fo:] *= np.linspace(1, 0, fo)[:, None]
    mix /= (np.abs(mix).max() + 1e-9)
    mix *= 0.75
    with wave.open(out_wav, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(44100)
        w.writeframes((mix * 32767).astype(np.int16).tobytes())
    print("music synth ok %.1fs -> %s" % (DUR, out_wav), flush=True)


def build_music(tot, cta_t, out_wav):
    """Arquivo real de worker/assets/music/ (Artlist) se existir; senão synth numpy."""
    src = _pick_music_file()
    if src:
        fade_out = min(2.8, max(0.5, tot / 3))
        run(FF + ["-stream_loop", "-1", "-i", src, "-t", "%.2f" % tot,
                  "-af", "afade=t=in:st=0:d=0.6,afade=t=out:st=%.2f:d=%.2f" % (max(0.0, tot - fade_out), fade_out),
                  "-ar", "44100", "-ac", "2", out_wav])
        print("music file ok -> %s (%s)" % (out_wav, os.path.basename(src)), flush=True)
        return os.path.basename(src)
    synth_music(tot, cta_t, out_wav)
    return "synth"


def cine_music(tot, cut_starts, riser_t, out_wav, mood="booms"):
    """Trilha cinematográfica PROVADA (assemble_spot2/assemble_spot3):
    mood='booms' — 80bpm, baixos A-F-G-E, pulsos de meio-tempo, booms graves nos
    cortes (cut_starts) e riser terminando no endcard (riser_t);
    mood='sinos' — 68bpm, graves suaves C-A-F-G em hanning + sinos alternados L/R."""
    SR = 44100
    N = int(SR * (tot + 0.5))
    Lc = np.zeros(N)
    Rc = np.zeros(N)

    def put(A, p, s):
        if p < 0 or p >= N:
            return
        e = min(N, p + len(s))
        A[p:e] += s[:e - p]

    if mood == "sinos":
        beat = 60 / 68.0
        prog = [130.81, 110.00, 87.31, 98.00]  # C A F G graves suaves
        tt = 0.0
        bi = 0
        while tt < tot:
            bass = prog[bi % 4]
            bar = 4 * beat
            nb = int(bar * SR)
            tb = np.arange(nb) / SR
            pad = (np.sin(2 * np.pi * bass * tb) + 0.6 * np.sin(2 * np.pi * bass * 2.005 * tb)
                   + 0.35 * np.sin(2 * np.pi * bass * 3 * tb))
            e2 = np.hanning(nb)
            put(Lc, int(tt * SR), pad * e2 * 0.15)
            put(Rc, int(tt * SR), pad * e2 * 0.15)
            for q in (0, 2):
                st = tt + q * beat
                if st >= tot:
                    break
                nn = int(1.2 * SR)
                tb2 = np.arange(nn) / SR
                bell = np.sin(2 * np.pi * bass * 4 * tb2) * np.exp(-tb2 / 0.5) * 0.06
                put(Lc if q == 0 else Rc, int(st * SR), bell)
            tt += bar
            bi += 1
        fi, fo, amp = int(1.2 * SR), int(3.0 * SR), 0.7
    else:
        beat = 60 / 80.0
        prog = [110.00, 87.31, 98.00, 82.41]  # A F G E baixo
        tt = 0.0
        bi = 0
        while tt < tot:
            bass = prog[bi % 4]
            bar = 4 * beat
            nb = int(bar * SR)
            tb = np.arange(nb) / SR
            pad = (np.sin(2 * np.pi * bass * 2 * tb) + 0.5 * np.sin(2 * np.pi * bass * 3 * tb)
                   + 0.3 * np.sin(2 * np.pi * bass * 4.01 * tb))
            envp = (np.minimum(1, np.minimum(tb / 1.2, (bar - tb) / 1.2).clip(0))
                    if bar > 2.4 else np.hanning(nb))
            put(Lc, int(tt * SR), pad * envp * 0.16)
            put(Rc, int(tt * SR), pad * envp * 0.16)
            for e8 in range(8):
                st = tt + e8 * beat / 2
                if st >= tot:
                    break
                nn = int(0.22 * SR)
                tb2 = np.arange(nn) / SR
                pl = np.sin(2 * np.pi * bass * tb2) * np.exp(-tb2 / 0.09) * 0.3
                put(Lc, int(st * SR), pl)
                put(Rc, int(st * SR), pl)
            tt += bar
            bi += 1

        def boom(g=0.6):
            nn = int(0.8 * SR)
            tb2 = np.arange(nn) / SR
            s = np.sin(2 * np.pi * (55 * np.exp(-tb2 * 3) + 38) * tb2) * np.exp(-tb2 / 0.30)
            x = np.random.randn(nn) * np.exp(-tb2 / 0.05) * 0.3
            return (s + np.convolve(x, np.ones(30) / 30, mode="same")) * g

        for j, ct in enumerate(cut_starts):
            bm = boom(0.8 if j == len(cut_starts) - 1 else 0.55)
            put(Lc, int((ct - 0.05) * SR), bm)
            put(Rc, int((ct - 0.05) * SR), bm)
        rn = int(2.2 * SR)
        rx = np.random.randn(rn)
        rx = np.convolve(rx, np.ones(12) / 12, mode="same") * ((np.arange(rn) / rn) ** 2.6) * 0.4
        put(Lc, int((riser_t - 2.2) * SR), rx)
        put(Rc, int((riser_t - 2.2) * SR), rx)
        fi, fo, amp = int(0.8 * SR), int(2.6 * SR), 0.8

    mix = np.stack([Lc, Rc], axis=1)
    mix[:fi] *= np.linspace(0, 1, fi)[:, None]
    end = min(N, int((tot + 0.5) * SR))
    fo = min(fo, end)
    if fo > 0:
        mix[end - fo:end] *= np.linspace(1, 0, fo)[:, None]
    mix /= max(1.0, np.abs(mix).max())
    mix *= amp
    with wave.open(out_wav, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((mix * 32767).astype(np.int16).tobytes())
    print("music cine ok %.1fs (%s) -> %s" % (tot, mood, out_wav), flush=True)


# ---------------------------------------------------------------- SFX
def write_sfx(starts, trans, tot, out_wav):
    """Whoosh nos sweeps — port PROVADO do assemble2.py passo [5/6]."""
    SR = 44100
    buf = np.zeros(int(SR * (tot + 0.5)))

    def whoosh(dd=0.42):
        nn = int(SR * dd)
        t = np.arange(nn) / SR
        x = np.random.randn(nn)
        lp = np.convolve(x, np.ones(24) / 24, mode="same")
        s = lp * np.sin(np.pi * t / dd) ** 2 * np.hanning(nn)
        return s / (np.abs(s).max() + 1e-9)

    wh = whoosh()
    n = len(starts)
    for k in range(1, n):
        g = 0.55 if trans[k - 1].startswith("slide") or trans[k - 1].startswith("smooth") else 0.3
        p = int(SR * max(0, starts[k] - 0.14))
        e = min(len(buf), p + len(wh))
        buf[p:e] += wh[:e - p] * g
    buf /= max(1.0, np.abs(buf).max())
    with wave.open(out_wav, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((buf * 0.9 * 32767).astype(np.int16).tobytes())
    print("sfx ok -> %s" % out_wav, flush=True)
