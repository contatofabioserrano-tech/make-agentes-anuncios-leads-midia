# -*- coding: utf-8 -*-
"""Legendas do modo 'integra': transcrição com faster-whisper SE importável;
sem a lib (ou em falha), segue sem legendas — nunca derruba o render."""
import os


def _ts(x):
    h = int(x // 3600)
    m = int(x % 3600 // 60)
    s = x % 60
    return "%d:%02d:%05.2f" % (h, m, s)


def _wrap(txt, width=36):
    words = txt.split()
    lines, cur = [], ""
    for w in words:
        if cur and len(cur) + 1 + len(w) > width:
            lines.append(cur)
            cur = w
        else:
            cur = (cur + " " + w).strip()
    if cur:
        lines.append(cur)
    return "\\N".join(lines[:2])  # máx 2 linhas por evento


def transcribe_ass(src, out_ass, offset=0.0):
    """Retorna o path do .ass gerado ou None (skip gracioso)."""
    try:
        from faster_whisper import WhisperModel
    except Exception:
        print("[captions] faster-whisper indisponível — seguindo sem legendas", flush=True)
        return None
    try:
        model = WhisperModel(os.environ.get("FW_MODEL", "small"),
                             device="cpu", compute_type="int8")
        segments, _info = model.transcribe(src, language="pt", vad_filter=True)
        events = []
        for s in segments:
            txt = (s.text or "").strip().replace("{", "(").replace("}", ")")
            if not txt:
                continue
            a = max(0.0, float(s.start) + offset)
            b = max(a + 0.4, float(s.end) + offset)
            events.append("Dialogue: 0,%s,%s,Cap,,0,0,0,,%s" % (_ts(a), _ts(b), _wrap(txt)))
        if not events:
            print("[captions] transcrição vazia — seguindo sem legendas", flush=True)
            return None
        ass = (
            "[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\n"
            "WrapStyle: 2\nScaledBorderAndShadow: yes\n\n"
            "[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, "
            "OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, "
            "Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
            "Style: Cap,Poppins SemiBold,58,&H00FFFFFF,&H000000FF,&H00000000,&H78000000,"
            "1,0,0,0,100,100,0,0,1,4,2,2,60,60,240,1\n\n"
            "[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
            + "\n".join(events) + "\n"
        )
        with open(out_ass, "w", encoding="utf-8") as f:
            f.write(ass)
        print("[captions] %d eventos -> %s" % (len(events), out_ass), flush=True)
        return out_ass
    except Exception as e:
        print("[captions] transcrição falhou (%s) — seguindo sem legendas" % str(e)[:150], flush=True)
        return None
