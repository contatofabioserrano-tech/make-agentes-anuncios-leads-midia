# Servidor Hetzner

## O que roda onde
| Parte | Onde |
|---|---|
| Portal (Next.js) | Vercel (como hoje) |
| Banco, login, arquivos | Supabase (como hoje) |
| Agente de anúncios, leitura de materiais, vídeo, sync do Odoo (só leitura) | **Hetzner**, em Docker, 24 h |
| Migrações do banco | **Hetzner**, automáticas a cada push (`scripts/db/migrate.sh`) |

## Montar (uma vez)
1. Hetzner Cloud → Add server → **Ubuntu 24.04**, **CPX31** (4 vCPU, 8 GB), região Ashburn ou Nuremberg, com sua chave SSH.
2. No terminal: `ssh root@IP_DO_SERVIDOR` e rode:
   ```
   curl -fsSL -o bootstrap.sh https://raw.githubusercontent.com/contatofabioserrano-tech/fortuna-creative/kit-teste-anuncios-marketplaces/infra/bootstrap.sh && bash bootstrap.sh
   ```
   (repo privado: se o curl der 404, copie `infra/bootstrap.sh` para o servidor e rode `bash bootstrap.sh`).
3. O script guia 3 passos: colar a deploy key no GitHub, preencher o `.env.server`, colar 2 secrets no GitHub.

## Depois
- Cada push em `supabase/migrations/`, `worker/`, `scripts/` ou `infra/` atualiza o servidor e aplica as migrações.
- Ver logs: `cd /opt/fortuna && docker compose -f infra/docker-compose.yml logs -f agente`
- Deploy à mão: `/opt/fortuna/infra/deploy.sh kit-teste-anuncios-marketplaces`
