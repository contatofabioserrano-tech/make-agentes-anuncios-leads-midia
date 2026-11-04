#!/usr/bin/env bash
# Atualiza o servidor: puxa o código, aplica migrações no banco e sobe os serviços.
# Chamado pelo GitHub Actions a cada push (ou à mão: sudo /opt/fortuna/infra/deploy.sh).
set -euo pipefail
BRANCH="${1:-main}"
cd /opt/fortuna
git fetch --quiet origin "$BRANCH"
git checkout --quiet -B "$BRANCH" "origin/$BRANCH"
set -a; . ./.env.server; set +a
./scripts/db/migrate.sh
docker compose -f infra/docker-compose.yml up -d --build --remove-orphans
docker image prune -f >/dev/null
echo "deploy ok: $(git rev-parse --short HEAD) ($BRANCH)"
