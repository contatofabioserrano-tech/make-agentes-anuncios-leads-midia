# Fortuna Creative — Render Worker (motor real)

Serviço em segundo plano que transforma projetos aprovados em vídeos finais.
Roda **localmente na máquina do dono** (Windows ou macOS): fica ligado num
terminal e processa a fila `public.render_jobs` do Supabase.

Fluxo por job: claim atômico → `pipeline_py/run_pipeline.py` (motor Python,
adaptado dos scripts PROVADOS do comercial Dr. Jund Pet) → upload dos MP4 no
bucket público **`renders`** → `render_jobs` = `done` (com `output_path`) →
`projects` = `concluido`/`done` → linha em `library_assets` + mensagem no chat.

Autentica com a **service_role** key do Supabase (bypassa RLS). É secreta:
só em variável de ambiente do host, nunca no app, nunca commitada.

## Arquivos

- `worker.mjs` — loop de polling, claim, progresso, upload, bookkeeping, erros.
- `pipeline.mjs` — ponte Node → Python: workdir temporário, download da fonte
  (modo `integra`), spawn do `run_pipeline.py`, parse de `PROGRESS`/`STAGE`.
- `pipeline_py/run_pipeline.py` — motor: roteiro (prompts DP + copy, refino
  xAI opcional) → imagens `nano_banana_2` → animação `kling3_0` → locução
  pt-BR (ElevenLabs ou edge-tts) → cards/painéis da marca (Pillow) → montagem
  ffmpeg (sweeps xfade, kinetic ASS, ducking sidechain, loudnorm -14).
- `pipeline_py/reference/` — scripts originais provados (fonte da verdade;
  o README de lá lista os gotchas pagos).
- `assets/music/` — solte aqui .mp3/.wav licenciados (Artlist). Com arquivo,
  a trilha vem dele; sem arquivo, o pipeline sintetiza uma trilha upbeat.

## Tipos de vídeo (spec.videoType)

| Tipo | O que gera |
|---|---|
| `comercial30` | 5 cenas geradas (hook, negócio, detalhe, tech, final) + painéis + CTA, ~30-40s |
| `reel` | Versão enxuta ~20-28s (sem a cena tech, holds menores) |
| `integra` | Painel de marca + vídeo-fonte do cliente (baixado do bucket `videos`) + card CTA; legendas via faster-whisper **se instalado**, trilha duckada pela narração |

Saída: `final_9x16.mp4` sempre; se `spec.aspect` incluir `16:9`, também
`final_16x9.mp4` (blur-pad). Ambos sobem pro bucket `renders`.

## Variáveis de ambiente

| Var | Obrigatória | Notas |
|---|---|---|
| `SUPABASE_URL` | sim | já preenchida no `.env.example` |
| `SUPABASE_SERVICE_ROLE_KEY` | sim | **SECRETA** — Supabase → Settings → API → `service_role` |
| `WORKER_ID` | não | id estável do worker (default: `worker-<hostname>`) |
| `POLL_INTERVAL_MS` | não | default `5000` |
| `PYTHON_BIN` | não | default `python` |
| `ELEVENLABS_API_KEY` | não | com key: locução ElevenLabs; sem: edge-tts pt-BR (grátis) |
| `ELEVENLABS_VOICE_ID` | não | default `pNInz6obpgDQGcFmaJgB` |
| `XAI_API_KEY` | não | com key: refina hook/CTA via xAI; sem: templates |
| `XAI_MODEL` | não | default `grok-4` |

## Pré-requisitos (no PATH)

- **Node.js ≥ 20** — `node --version`
- **Python 3.10+** — `python --version`
- **ffmpeg + ffprobe** — `ffmpeg -version` (montagem final; obrigatório)
- **higgsfield CLI instalado e LOGADO** — `higgsfield --version`
  (obrigatório pra `comercial30`/`reel`; o `integra` não usa)
- Libs Python: `pip install pillow numpy edge-tts`
- Opcional (legendas do `integra`): `pip install faster-whisper`

## Rodar no Windows (igual no macOS)

```powershell
cd worker
npm install
pip install pillow numpy edge-tts
copy .env.example .env   # macOS/Linux: cp .env.example .env
# abra worker/.env e cole a SUPABASE_SERVICE_ROLE_KEY
npm run worker
```

Ao iniciar:

```
[worker] started as worker-<host>, polling every 5000ms
[worker] tools — ffmpeg: ok, python: ok, higgsfield: ok
```

Deixe o terminal aberto: cada projeto aprovado no app entra na fila
`render_jobs` e é processado automaticamente. `Ctrl+C` para parar.

## Progresso e erros

O Python emite `PROGRESS 10/30/55/75/90` (roteiro → imagens → vídeos →
locução+assets → montagem) e o worker grava em `render_jobs.progress`
(100 após o upload). Em falha, `render_jobs.error` traz o **estágio** que
quebrou (ex.: `estágio "imagens": higgsfield sem URL: ...`) e o projeto vai
pra `status='erro'`.

## Notas

- O claim é condicional (`update … where status='queued'`) — vários workers
  podem rodar em paralelo sem processar o mesmo job.
- Higgsfield no Windows: o motor chama o CLI via `cmd /c` em lista, prompt em
  linha única, `--wait --json` — padrão provado; não mude sem ler
  `pipeline_py/reference/README.md`.
- ffmpeg roda sempre com `cwd = workdir` e paths RELATIVOS (nunca `C:\...`
  dentro de filtergraph).
