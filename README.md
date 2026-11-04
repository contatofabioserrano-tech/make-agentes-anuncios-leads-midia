# Fortuna Creative — Studio

Portal interno da **Fortuna Creative**: a equipe sobe um vídeo e o edita através
de um chat de aprovação conduzido por uma **squad de agentes** (Roteirista,
Diretor de Imagem, Legendador, Montador). Cada etapa é entregue e aprovada pela
pessoa antes de seguir — e, ao final, um worker renderiza o vídeo final em 9:16.

> Criatividade na velocidade da IA.

## Stack

- **Next.js 14.2** (App Router) + **React 18** + **TypeScript**
- **Tailwind CSS** (tema da marca: gradiente azul → violeta, fonte Sora)
- **Supabase** — Auth (cookie-based via `@supabase/ssr`), Postgres + RLS, Storage
- **Render worker** separado (Node + ffmpeg + Higgsfield/Whisper/Kling) — ver `worker/`

## Estrutura

```
app/
  login/                  Login da equipe
  (app)/                  Shell autenticado (sidebar)
    projetos/             Grid + criação de projeto (upload de vídeo)
    projetos/[id]/        Núcleo: preview + chat agêntico de aprovação
    biblioteca/           Galeria de assets (imagem/vídeo/áudio)
    admin/                Usuários, projetos e relatórios (somente admin)
  auth/signout/           Route handler de logout
lib/                      Supabase clients, tipos, flow da squad, auth helper
components/               Logo, sidebar, badges, header
worker/                   Render worker (deploy à parte)
```

## Logins (ambiente de demonstração)

| E-mail | Papel |
|---|---|
| `admin@fortunacreative.com.br` | admin |
| `felipe@fortunacreative.com.br` | membro |
| `jacqueline@fortunacreative.com.br` | membro |
| `carol@fortunacreative.com.br` | membro |
| `miguel@fortunacreative.com.br` | membro |
| `mario@fortunacreative.com.br` | membro |

Senha temporária inicial: **`Fortuna@2026`** — troque no primeiro acesso.

## Rodar localmente

```bash
# 1) variáveis de ambiente
cp .env.example .env.local   # já contém a URL e a anon key (públicas)

# 2) dependências
npm install

# 3) desenvolvimento
npm run dev                  # http://localhost:3000

# build de produção
npm run build
npm run start
```

## Variáveis de ambiente

| Var | Onde | Notas |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` | Pública |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.local` | Pública — respeita RLS via sessão |

A `service_role` key **não** é usada pelo app web — apenas pelo worker. Nunca a
coloque em variáveis `NEXT_PUBLIC_*` nem no front-end.

## Fluxo da squad (resumo)

1. Novo projeto → upload do vídeo para o bucket `videos` (`<uid>/<arquivo>`),
   cria `projects` (`status=em_andamento`, `stage=roteiro`).
2. Na página do projeto, o agente da etapa atual posta uma **entrega** + um
   **pedido de aprovação**.
3. **Aprovar** avança a etapa; o próximo agente entrega. **Ajustar** mantém a
   etapa e o agente re-entrega incorporando o feedback.
4. Ao aprovar a Montagem, um `render_jobs` é enfileirado (`queued`) e o projeto
   vai para `renderizando`.
5. O **worker** processa, sobe o resultado em `renders`, marca `concluido` e
   adiciona o vídeo à biblioteca. O vídeo final aparece com botão de download.

## Worker de render

Código em `worker/` (não fazemos deploy aqui). Passos completos de deploy
(Railway / Fly.io) e variáveis em [`worker/README.md`](worker/README.md).
A `SUPABASE_SERVICE_ROLE_KEY` é **secreta** e só vive no host do worker.

## Deploy do app (Vercel)

1. Importe o repositório na Vercel.
2. Configure `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Deploy. O middleware cuida do refresh de sessão e da proteção de rotas.
