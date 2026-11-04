# Máquina de anúncios: TikTok Shop

Primeiro anúncio pronto: **Filamento PETG Creality Hyper Series 1,75 mm 1 kg, variação Preto**
(Odoo Kairós #58, SKU `3301030043`). No portal: **Anúncios → TikTok Shop**.

## O que tem no portal (`/anuncios/hyper-petg-preto`)

- **Prévia** no formato da página de produto do TikTok Shop: galeria, preço, título, variação, descrição e vídeo.
- **Checklist da política**, gerado automaticamente a cada abertura da página.
- **Campos para colar no Seller Center**: título, categoria, marca, variação, descrição e atributos, cada um com botão Copiar.
- **Imagens na ordem de upload** e **vídeo do anúncio**, todos para baixar.
- **Pacote para viralizar**: vídeo do feed em 1080p, legenda com hashtags, 5 ganchos, CTAs, roteiro, palavras-chave de busca, briefing para criadores e plano de postagem.
- **Calculadora de preço e margem**: custo FOB do Odoo já preenchido, comissão e frete editáveis.
- **Exportar** em JSON (anúncio completo + verificações) ou CSV (campo; valor).

## Regras aplicadas (Política de Listagem do TikTok Shop Brasil, 28/10/2026)

| Regra | Como o anúncio atende |
|---|---|
| Título entre 25 e 200 caracteres, iniciais maiúsculas, sem cor e sem termo promocional | 100 caracteres; a cor fica na variação "Cor: Preto" |
| Descrição em português com pelo menos 500 caracteres / 30 palavras, 3 a 5 tópicos, origem, garantia, cuidados e conteúdo da embalagem | 1256 caracteres, 5 tópicos |
| Sem link, contato, QR code ou promoção | validado |
| Até 9 imagens quadradas com pelo menos 600 px, **sem texto, selo ou borda** | 7 imagens na galeria; as 2 com texto vão na descrição |
| Imagem principal: foto real, frontal, fundo branco puro | foto oficial da Creality, 1600 px, 100% da borda branca |
| Sem ângulos repetidos | 7 ângulos/cenas diferentes |
| 1 vídeo de até 5 MB | 2,05 MB, 18 s, 720×1280 |

As regras ficam em `lib/marketplace/tiktok.ts`. Se a política mudar, é só editar `LIMITS` e `PROMO_TERMS`.

## Pendências do vendedor (o validador mostra em azul)

1. **Preço de venda.** Use a calculadora e preencha `price` em `lib/marketplace/data/hyper-petg-preto.json`.
2. **Estoque** da variação.
3. **Peso e dimensões da caixa de 1 rolo**, que o TikTok Shop exige para calcular o frete.
4. **Autorização da marca Creality (LOA)**: Seller Center → Minha conta → Centro de qualificação → Qualificação da marca.

Aviso: 6 imagens da galeria são cenas geradas por IA. Antes de publicar, uma pessoa precisa conferir que cor, rótulo e
carretel batem com o produto entregue. A política só aceita imagem de IA se ela for fiel ao produto.

## Como gerar de novo (a máquina)

```bash
pip install pillow numpy
python3 scripts/anuncios/build_commercial.py    # 4 cenas de uso real + locução ElevenLabs + trilha + legendas -> comercial do feed e do produto
python3 scripts/anuncios/build_tiktok_assets.py # imagens 1:1, vídeo <= 5 MB e medições reais (assets.json)
npm run test:anuncios                            # 14 testes: anúncio real aprovado + 11 casos de reprovação
npm run build                                    # portal
```

As fontes ficam em `kits/58-creality-hyper-petg-preto/fontes/`:
- foto oficial;
- cenas de IA (imagens);
- 4 cenas de vídeo de uso real em 1080p (`cena1..4`);
- locução `voz_gabriel_take1.mp3`;
- `trilha.mp3`.

## Comercial (vídeo do feed)

18 s, 1080×1920, 4 cenas de uso real:
1. bico imprimindo rápido;
2. abrindo a embalagem a vácuo e colocando o rolo na impressora;
3. peça soltando da mesa;
4. teste de força.

Em seguida vêm a foto do rolo embalado e o cartão "Toca no carrinho".

- **Voz:** ElevenLabs, "Gabriel's voice" (pt-BR, influência carioca, ritmo de vendas), modelo eleven_v4. A transcrição confere o texto e marca o tempo de cada palavra para sincronizar a legenda.
- **Trilha:** ElevenLabs Music, instrumental (conferido: nenhum trecho de voz na trilha).
- **Áudio da voz:** passa-alta, presença +3 dB em 3 kHz e compressor.
- **Áudio da trilha:** recorte de −4 dB em 2,5 kHz e abaixa sozinha quando a voz entra (ducking).
- **Volume final:** −14 LUFS (padrão TikTok).
