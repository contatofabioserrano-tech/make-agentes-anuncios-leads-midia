# fortuna-creative / motion

Pacote Remotion de motion graphics de marca (energia de comercial Nubank), parametrizado por props.
O worker do pipeline de video renderiza estes clipes via CLI e compoe o resultado com ffmpeg.

- Todas as composicoes: **1080x1920 (9:16), 30 fps**
- Fonte: **Poppins** via `@remotion/google-fonts/Poppins` (carregada automaticamente no bundle)
- Logo default: `public/logo.png` (Dr. JundPet), referenciada com `staticFile('logo.png')`

## Composicoes

| ID | Frames | Duracao | Fundo | Descricao |
|---|---|---|---|---|
| `LogoIntro` | 75 | 2.5s | opaco (primary) | Logo entra com spring + glow pulsante, gradiente radial sutil |
| `BrandSweep` | 33 | 1.1s | transparente fora do painel | Painel full-screen varre da direita (ou esquerda) com borda de ataque arredondada; logo + palavra dao pop |
| `KineticText` | 90 | 3.0s | **transparente** | 1-2 linhas Poppins bold, entrada por palavra com spring escalonado, keyword em accent |
| `CTACard` | 150 | 5.0s | opaco (primary) | Logo, titulo type-on, linhas de contato subindo escalonadas, faixa de tagline, float continuo |
| `LowerThird` | 120 | 4.0s | **transparente** | Barra de endereco entra da esquerda com notch accent |

## Props

Todas as composicoes aceitam o mesmo shape (`BrandProps` em `src/brand.ts`):

```json
{
  "primary": "#0F3D2E",
  "accent": "#FF7A00",
  "logoUrl": "<staticFile ou URL http>",
  "line1": "MEDICINA DE PONTA.",
  "line2": "AMOR QUE FICA.",
  "word": "AMOR",
  "phone": "(11) 4587-2600",
  "whatsapp": "(11) 99999-0000",
  "address": "Av. Nove de Julho, 1000 - Jundiai/SP",
  "tagline": "Medicina de ponta. Amor que fica."
}
```

Extras do `BrandSweep`: `"direction": "fromRight" | "fromLeft"` e `"color": "primary" | "accent"`.
No `KineticText`, `word` e a keyword destacada em accent (comparacao case-insensitive, pontuacao ignorada).
No `CTACard`, `line1` e o titulo do type-on (default `AGENDE SUA CONSULTA`).

Defaults completos (Dr. JundPet) ja registrados em `src/Root.tsx` — renderizar sem `--props` usa a marca Dr. JundPet.

## Comandos de render

Sempre rodar de dentro de `motion/`:

```bash
# 1. LogoIntro (opaco, h264)
npx remotion render LogoIntro out/logo_intro.mp4

# 2. BrandSweep (h264; para compor por cima de footage, use a variante ProRes abaixo)
npx remotion render BrandSweep out/brand_sweep.mp4

# 3. KineticText — TRANSPARENTE (ProRes 4444 com canal alpha)
npx remotion render KineticText out/kinetic_text.mov --codec=prores --prores-profile=4444 --image-format=png --pixel-format=yuva444p10le

# 4. CTACard (opaco, h264)
npx remotion render CTACard out/cta_card.mp4

# 5. LowerThird — TRANSPARENTE (ProRes 4444 com canal alpha)
npx remotion render LowerThird out/lower_third.mov --codec=prores --prores-profile=4444 --image-format=png --pixel-format=yuva444p10le
```

### Passando props (outra marca / outro texto)

```bash
npx remotion render BrandSweep out/sweep_24h.mov \
  --codec=prores --prores-profile=4444 --image-format=png --pixel-format=yuva444p10le \
  --props='{"word":"24 HORAS","direction":"fromRight","color":"accent","primary":"#0F3D2E","accent":"#FF7A00"}'
```

No Windows (PowerShell), prefira passar um arquivo: `--props=./props.json`.

### Transparencia

- `--codec=prores --prores-profile=4444 --image-format=png --pixel-format=yuva444p10le` preserva o canal alpha (saida `.mov`).
- O `--image-format=png` e OBRIGATORIO: o `remotion.config.ts` fixa jpeg como formato de frame default (mais rapido pros renders opacos), e jpeg nao tem alpha.
- O `--pixel-format=yuva444p10le` tambem e OBRIGATORIO: sem ele o encoder ProRes entrega yuv422 SEM canal alpha (verificado com ffprobe; com o flag a saida sai `yuva444p12le`).
- Alternativa em sequencia de imagens: `npx remotion render KineticText out/frames --sequence --image-format=png`.
- `KineticText` e `LowerThird` nao pintam fundo; `BrandSweep` so pinta o painel (fora dele e alpha).

## Como o worker chama

O worker executa o CLI dentro de `motion/` e depois compoe com ffmpeg:

```bash
# 1. Renderiza o overlay transparente com props da marca do job
npx remotion render LowerThird out/{job}/lower_third.mov \
  --codec=prores --prores-profile=4444 --image-format=png --pixel-format=yuva444p10le \
  --props=out/{job}/props.json

# 2. Compoe por cima do video base (ffmpeg overlay respeita o alpha do ProRes 4444)
ffmpeg -i base.mp4 -i out/{job}/lower_third.mov \
  -filter_complex "[0:v][1:v]overlay=0:0:enable='between(t,2,6)'" \
  -c:v libx264 -pix_fmt yuv420p final.mp4

# Clipes opacos (LogoIntro, CTACard) entram por concat:
ffmpeg -f concat -safe 0 -i lista.txt -c copy final.mp4
```

## Dev

```bash
npm install
npm run studio        # preview interativo
npx tsc --noEmit      # type-check
```

Proofs de fumaca (baratos):

```bash
npx remotion render BrandSweep out/proof_sweep.mp4 --frames=0-32 --scale=0.5
npx remotion render LogoIntro out/proof_intro.mp4 --frames=0-20 --scale=0.25
```
