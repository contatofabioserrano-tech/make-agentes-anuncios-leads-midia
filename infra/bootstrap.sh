#!/usr/bin/env bash
# Prepara um servidor Hetzner novo (Ubuntu 24.04). Rodar UMA vez, como root:
#   curl -fsSL https://raw.githubusercontent.com/<repo>/<branch>/infra/bootstrap.sh | bash
# ou copiar este arquivo para o servidor e rodar: bash bootstrap.sh
set -euo pipefail
REPO="git@github.com:contatofabioserrano-tech/fortuna-creative.git"
BRANCH="${BRANCH:-kit-teste-anuncios-marketplaces}"

apt-get update -q
apt-get install -y -q ca-certificates curl git postgresql-client ufw
if ! command -v docker >/dev/null; then curl -fsSL https://get.docker.com | sh; fi
ufw allow OpenSSH >/dev/null && ufw --force enable >/dev/null

# chave para o servidor LER o repositório (Deploy key, só leitura)
mkdir -p /root/.ssh && chmod 700 /root/.ssh
[ -f /root/.ssh/github_deploy ] || ssh-keygen -t ed25519 -N "" -f /root/.ssh/github_deploy -C "hetzner-fortuna" >/dev/null
cat > /root/.ssh/config <<CFG
Host github.com
  IdentityFile /root/.ssh/github_deploy
  StrictHostKeyChecking accept-new
CFG
# chave para o GitHub Actions ENTRAR no servidor e rodar o deploy
[ -f /root/.ssh/actions_deploy ] || ssh-keygen -t ed25519 -N "" -f /root/.ssh/actions_deploy -C "github-actions" >/dev/null
grep -qf /root/.ssh/actions_deploy.pub /root/.ssh/authorized_keys 2>/dev/null || cat /root/.ssh/actions_deploy.pub >> /root/.ssh/authorized_keys

echo
echo "==================== PASSO 1 de 3 ===================="
echo "GitHub → repositório → Settings → Deploy keys → Add deploy key (sem marcar escrita). Cole:"
cat /root/.ssh/github_deploy.pub
echo
read -r -p "Depois de colar no GitHub, aperte Enter..." _ </dev/tty

[ -d /opt/fortuna/.git ] || git clone --quiet --branch "$BRANCH" "$REPO" /opt/fortuna
cd /opt/fortuna
chmod +x infra/*.sh scripts/db/*.sh
[ -f .env.server ] || cp infra/env.server.example .env.server
chmod 600 .env.server

echo
echo "==================== PASSO 2 de 3 ===================="
echo "Preencha as chaves em /opt/fortuna/.env.server  (nano /opt/fortuna/.env.server)"
read -r -p "Depois de salvar, aperte Enter..." _ </dev/tty
./infra/deploy.sh "$BRANCH"

echo
echo "==================== PASSO 3 de 3 ===================="
echo "GitHub → Settings → Secrets and variables → Actions → New repository secret:"
echo "  HETZNER_HOST    = $(curl -s https://api.ipify.org || hostname -I | awk '{print $1}')"
echo "  HETZNER_SSH_KEY = (o conteúdo abaixo, inteiro)"
cat /root/.ssh/actions_deploy
echo
echo "Pronto. A cada push o servidor atualiza sozinho e aplica as migrações do banco."
