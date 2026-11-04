# MakeOne — máquina de anúncios, leads e mídia

Base copiada do portal `fortuna-creative` (cliente Grupo Kairós) em 04/11/2026, para virar o produto da **MakeOne**.
Os dados de produto da Kairós que ficaram aqui (Hyper PETG em `lib/marketplace/data` e `public/marketplace/hyper-petg-preto`) são **só exemplo** e devem sair quando houver o primeiro produto da MakeOne. Custos internos da Kairós foram removidos.

## O que já funciona (herdado)
- Portal Next.js 14 + Supabase (login, RLS), multiempresa (`mk_companies`, membros, convites, `company_id` em tudo).
- Agente Python (`worker/agente/ads_agent.py`):
  - lê links/fotos/PDFs (`ingest.py`) → cadastro padrão → anúncios;
  - imagens: principal fundo branco, cenas de IA e UGC (Higgsfield CLI), imagens de dúvidas;
  - **vídeo comercial no padrão "uso real"** (`commercial.py`): 6 trechos, legenda sincronizada, cartão final, trilha;
  - textos e validadores: TikTok Shop, Mercado Livre, Shopee, Amazon BR, Magalu, Alibaba (`lib/marketplace/*.ts`).
- Campanhas Meta/Google/OpenAI Ads com limites de caracteres e criativos 1:1, 4:5, 9:16, 1,91:1.
- Landing page de produto no padrão Pulse+ (`components/landing`), com formulário de lead (`mk_leads`).
- Infra: `infra/` (Hetzner + Docker + deploy por push + migrações automáticas `scripts/db/migrate.sh`).

## Decidir primeiro
1. **Supabase**: projeto próprio da MakeOne (recomendado: isolamento total) ou o mesmo do Fortuna.
   Se for próprio: criar o projeto, rodar `supabase/migrations/*.sql` em ordem (o 1º arquivo tem limpeza específica da Kairós: revisar/remover antes) e trocar as chaves em `.env.local` e no worker.
2. **Marca**: logo, cores e textos da MakeOne no portal (`components/Logo.tsx`, `tailwind.config.ts`, `app/layout.tsx`, `app/login`).
3. **Integração**: a MakeOne não usa o Odoo da Kairós. Remover/ocultar `scripts/odoo` e o "Catálogo Odoo" ou ligar ao sistema da MakeOne (ex.: CRM `makeone-portal-crm`).
4. **Leads e mídia**: o nome do repositório inclui leads e mídia: definir funil de leads (landing → `mk_leads` → CRM) e calendário de mídia.

## Feito (04/11/2026, branch `makeone/marca-portal`)
- Marca MakeOne provisória (tipográfica) no logo, título, login e menus. Cor de destaque centralizada em `accent` (`tailwind.config.ts`): trocar lá quando chegar a paleta oficial; logo oficial vai em `components/Logo.tsx`.
- "Catálogo Odoo" escondido por padrão (`NEXT_PUBLIC_ODOO_ENABLED=0`); rotas `/catalogo` redirecionam para `/fontes`. Empresas novas só podem ser do tipo "padrão".
- "Enviar materiais" é o fluxo principal (1º item do menu, botão no painel, links de "gerar novo" apontam para lá).
- Exemplos do Hyper PETG mantidos até existir o primeiro produto da MakeOne.

## Aguardando o Fábio
1. Supabase: projeto próprio ou o do Fortuna.
2. Logo (arquivo), cores e site da MakeOne.
3. Origem dos produtos (links, fotos, PDFs, CRM `makeone-portal-crm`…).
