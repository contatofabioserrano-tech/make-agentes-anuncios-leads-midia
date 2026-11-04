# Pipeline de referência (código PROVADO)

Estes scripts produziram os comerciais entregues do Dr. Jund Pet (run `2026-07-04_drjundpet-comercial-ia`,
finais em `Desktop/VIDEO EDITOR/`). São a fonte da verdade para o motor do worker — adapte, não reinvente.

Ordem original de execução (cwd = pasta do run):
1. `gen_images.py` — 5 prompts de DP (formato CAMERA/LENS/LIGHT/...) → nano_banana_2 9:16 2k (paralelo)
2. `gen_videos.py` — anima cada imagem no kling3_0 (5s, std, sound off, paralelo)
3. `prep_assets.py` — card CTA (Pillow) + trilha upbeat sintetizada (numpy; params: dur, cta_time, out)
4. `prep_v2.py` — locução edge-tts pt-BR + painéis de marca (sweeps) + lower-third de endereço
5. `assemble2.py` — montagem final: xfade sweeps + kinetic ASS + ducking sidechain + loudnorm -14

## Gotchas já pagos (NÃO reaprender do jeito difícil)
- Higgsfield CLI no Windows: `['cmd','/c','higgsfield',...]` em LISTA (nunca string shell); prompt em LINHA ÚNICA;
  decode `utf-8, errors='replace'`; `--wait --wait-timeout ... --json`; URL em `result_url` ou `results[0].url`;
  se voltar só um UUID, `higgsfield generate get <id> --json`.
- ffmpeg: NUNCA caminho absoluto `C:\` dentro de filtergraph (fontsdir etc) — usar relativo ao cwd.
- xfade: cada segmento renderizado com duração `d + XF` (padding do overlap); offset_k = soma das durações cruas - k*XF.
- ASS: cores BGR (`&H007AFF&` = laranja FF7A00); em `re.sub` o replacement precisa escapar `{\\1c...}` como
  `'{\\\\1c...}'` senão o `\1` vira backreference.
- Áudio: se um label alimenta 2 filtros (sidechain + amix), `asplit` antes; trilha ducked com
  `sidechaincompress` tendo a locução como sidechain.
- Anti-tremido: sem `zoompan` em cards, sem filtro `noise`, texto anima só com `\move`+`\fad` (sem pulsar escala).
- Paths históricos `V2`/`V4` nos scripts apontavam para runs antigos (fontes/logo/música) — no worker use
  `worker/pipeline_py/fonts/` e `logo_default.png` / logo da marca baixado do Storage.
