# -*- coding: utf-8 -*-
"""Higgsfield CLI (nano_banana_2 + kling3_0) — padrão PROVADO do gen_images2.py/gen_videos.py:
cmd /c em LISTA, prompt em LINHA ÚNICA, decode utf-8 errors=replace, --wait --json,
result_url/results[0].url, fallback por regex de URL e fallback via `generate get <uuid>`."""
import json
import os
import re
import subprocess
import threading
import urllib.request

_UUID_RE = r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"


def _base_cmd():
    # No Windows o CLI só resolve via `cmd /c` em lista (gotcha pago).
    return (["cmd", "/c"] if os.name == "nt" else []) + ["higgsfield"]


def _extract_url(out, exts):
    m = re.search(r"\{.*\}", out, re.S)
    j = {}
    if m:
        try:
            j = json.loads(m.group(0))
        except Exception:
            j = {}
    url = j.get("result_url") or (j.get("results") or [{}])[0].get("url") or j.get("url")
    if not url:
        urls = re.findall(r"https://\S+\.(?:%s)" % "|".join(exts), out)
        url = urls[0] if urls else None
    return url


def _uuid_fallback(out, exts):
    """Se o CLI devolveu só o UUID do job, busca o resultado com `generate get <id> --json`."""
    for jid in re.findall(_UUID_RE, out):
        try:
            o2 = subprocess.check_output(
                _base_cmd() + ["generate", "get", jid, "--json"],
                stderr=subprocess.STDOUT, timeout=600,
            ).decode("utf-8", errors="replace")
            url = _extract_url(o2, exts)
            if url:
                return url
        except Exception:
            continue
    return None


def _generate(args, dest, exts, timeout):
    cmd = _base_cmd() + args
    out = subprocess.check_output(
        cmd, stderr=subprocess.STDOUT, timeout=timeout
    ).decode("utf-8", errors="replace")
    url = _extract_url(out, exts)
    if not url:
        url = _uuid_fallback(out, exts)
    if not url:
        raise RuntimeError("higgsfield sem URL: " + out[-300:].replace("\n", " "))
    urllib.request.urlretrieve(url, dest)


def _run_parallel(items, fn, what):
    results = {}

    def worker(name, payload):
        try:
            fn(name, payload)
            results[name] = "OK"
        except Exception as e:
            results[name] = "ERRO: " + str(e)[:250]

    ths = [threading.Thread(target=worker, args=(k, v)) for k, v in items.items()]
    [t.start() for t in ths]
    [t.join() for t in ths]
    for k in items:
        print("%s %s -> %s" % (what, k, results.get(k, "?")), flush=True)
    bad = [k for k, v in results.items() if v != "OK"]
    if bad:
        raise RuntimeError("%s falharam: %s" % (what, "; ".join(
            "%s (%s)" % (k, results[k]) for k in bad)))


def gen_images(prompts, outdir="images2", aspect="9:16", resolution="2k"):
    os.makedirs(outdir, exist_ok=True)

    def one(name, prompt):
        flat = re.sub(r"\s*\n\s*", " ", prompt).strip()  # LINHA ÚNICA — obrigatório
        _generate(
            ["generate", "create", "nano_banana_2",
             "--prompt", flat, "--aspect_ratio", aspect, "--resolution", resolution,
             "--wait", "--wait-timeout", "15m", "--json"],
            os.path.join(outdir, name + ".png"),
            ("png", "jpg", "jpeg", "webp"), 1000,
        )

    _run_parallel(prompts, one, "imagem")


def gen_videos(motions, imgdir="images2", outdir="videos"):
    os.makedirs(outdir, exist_ok=True)

    def one(name, motion):
        _generate(
            ["generate", "create", "kling3_0",
             "--prompt", motion, "--start-image", "%s/%s.png" % (imgdir, name),
             "--duration", "5", "--mode", "std", "--sound", "off",
             "--wait", "--wait-timeout", "25m", "--json"],
            os.path.join(outdir, name + ".mp4"),
            ("mp4",), 1800,
        )

    _run_parallel(motions, one, "video")


def gen_videos_seedance(motions, imgdir="images", outdir="videos"):
    """Anima os stills no seedance_2_0 (--start-image) — padrão PROVADO do
    spot2_gen/spot3_gen: tenta com --duration 5 e, se o CLI recusar, sem ele."""
    os.makedirs(outdir, exist_ok=True)

    def one(name, motion):
        pre = ["generate", "create", "seedance_2_0",
               "--prompt", motion, "--start-image", "%s/%s.png" % (imgdir, name)]
        post = ["--wait", "--wait-timeout", "30m", "--json"]
        last = None
        for extra in (["--duration", "5"], []):
            try:
                _generate(pre + extra + post,
                          os.path.join(outdir, name + ".mp4"), ("mp4",), 2100)
                return
            except Exception as e:
                last = e
        raise RuntimeError("seedance falhou: %s" % str(last)[:200])

    _run_parallel(motions, one, "video")
