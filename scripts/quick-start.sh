#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${CYAN}[INFO]${NC} $*"; }
ok()    { echo -e "${GREEN}[OK]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
err()   { echo -e "${RED}[ERROR]${NC} $*"; }

PROJECT_NAME="Paracosm"
DEFAULT_PORT=7529

check_node() {
  if command -v node &>/dev/null; then
    local v
    v=$(node -v | sed 's/v//' | cut -d. -f1)
    if [ "$v" -ge 20 ]; then
      ok "Node.js $(node -v) detected"
      return 0
    else
      err "Node.js $(node -v) found, but >= 20.0.0 required"
      return 1
    fi
  else
    err "Node.js not found. Install Node.js >= 20.0.0 first:"
    echo "  Ubuntu/Debian: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"
    echo "  macOS:         brew install node@20"
    echo "  CentOS/RHEL:   curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash - && sudo yum install -y nodejs"
    return 1
  fi
}

check_pnpm() {
  if command -v pnpm &>/dev/null; then
    ok "pnpm $(pnpm -v) detected"
    return 0
  else
    warn "pnpm not found, installing..."
    if command -v npm &>/dev/null; then
      npm install -g pnpm
      ok "pnpm installed via npm"
    elif command -v curl &>/dev/null; then
      curl -fsSL https://get.pnpm.io/install.sh | sh -
      export PATH="$HOME/.local/share/pnpm:$PATH"
      ok "pnpm installed via standalone script"
    else
      err "Cannot install pnpm. Install it manually: npm install -g pnpm"
      return 1
    fi
  fi
}

install_deps() {
  info "Installing dependencies..."
  pnpm install --frozen-lockfile 2>/dev/null || pnpm install
  ok "Dependencies installed"
}

build_project() {
  info "Building all packages..."
  pnpm build
  ok "Build complete"
}

create_env() {
  if [ ! -f .env ]; then
    info "Creating default .env file..."
    cat > .env << ENVEOF
PARACOSM_PORT=${DEFAULT_PORT}
PARACOSM_HOST=0.0.0.0
PARACOSM_NODE_ENV=production
ENVEOF
    ok ".env created with default settings"
  else
    ok ".env already exists, skipping"
  fi
}

start_server() {
  info "Starting ${PROJECT_NAME} server on port ${DEFAULT_PORT}..."
  echo ""
  echo -e "${GREEN}========================================${NC}"
  echo -e "${GREEN}  ${PROJECT_NAME} is running!${NC}"
  echo -e "${GREEN}========================================${NC}"
  echo -e "  Web:  ${CYAN}http://localhost:${DEFAULT_PORT}${NC}"
  echo -e "  API:  ${CYAN}http://localhost:${DEFAULT_PORT}/api/v1${NC}"
  echo -e "  WS:   ${CYAN}ws://localhost:${DEFAULT_PORT}/ws${NC}"
  echo -e "${GREEN}========================================${NC}"
  echo ""

  if [ "${1:-}" = "--detach" ] || [ "${1:-}" = "-d" ]; then
    nohup pnpm start > paracosm.log 2>&1 &
    echo $! > paracosm.pid
    ok "Server started in background (PID: $(cat paracosm.pid))"
    ok "Log file: paracosm.log"
    ok "Stop with: kill \$(cat paracosm.pid)"
  else
    exec pnpm start
  fi
}

main() {
  echo -e "${CYAN}"
  echo "  ____                      _            "
  echo " |  _ \ __ _ _ __ __ _  ___| |_ ___ _ __ "
  echo " | |_) / _\` | '__/ _\` |/ __| __/ _ \ '__|"
  echo " |  __/ (_| | | | (_| | (__| ||  __/ |   "
  echo " |_|   \__,_|_|  \__,_|\___|\__\___|_|   "
  echo -e "${NC}"
  echo -e "  Quick Start Script v1.0"
  echo ""

  check_node || exit 1
  check_pnpm || exit 1
  install_deps
  build_project
  create_env
  start_server "$@"
}

main "$@"
