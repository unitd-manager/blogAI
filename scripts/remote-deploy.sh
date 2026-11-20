#!/usr/bin/env bash
# Runs ON THE SERVER, started by .github/workflows/deploy.yml. Installs a new release of SignalWrite:
#   1. back up the current version      4. restart the app (pm2, systemd, or your own command)
#   2. unpack the new version           5. check /api/health
#   3. install production packages      6. if anything fails: put the previous version back and restart
#
# Never touches .env (your keys and database settings) or anything outside APP_DIR.
#
# Settings (passed by the workflow; values ending in _B64 are base64-encoded):
#   APP_DIR / APP_DIR_B64     folder the app lives in (has .env, package.json)
#   RELEASE_TGZ               the uploaded release archive
#   APP_NAME / APP_NAME_B64   pm2 process or systemd service name (default: signalwrite)
#   RESTART_COMMAND / RESTART_B64   optional: your own restart command, used instead of pm2/systemd
#   COMMIT                    short commit id, for the log
set -Eeuo pipefail

decode() { if [ -n "${1:-}" ]; then printf '%s' "$1" | base64 -d; fi; }
APP_DIR="${APP_DIR:-$(decode "${APP_DIR_B64:-}")}"
APP_NAME="${APP_NAME:-$(decode "${APP_NAME_B64:-}")}"; APP_NAME="${APP_NAME:-signalwrite}"
RESTART_COMMAND="${RESTART_COMMAND:-$(decode "${RESTART_B64:-}")}"
COMMIT="${COMMIT:-unknown}"
RELEASE_TGZ="${RELEASE_TGZ:?RELEASE_TGZ is required}"

log() { printf '[deploy %s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }
fail() { log "ERROR: $*"; exit 1; }

[ -n "$APP_DIR" ] || fail "APP_DIR is empty. Set the DEPLOY_PATH secret."
[ -d "$APP_DIR" ] || fail "App folder $APP_DIR does not exist. Create it (see DEPLOY.md, first-time setup)."
[ -f "$RELEASE_TGZ" ] || fail "Release file $RELEASE_TGZ not found."
command -v node >/dev/null || fail "Node.js is not installed on the server."
command -v npm >/dev/null || fail "npm is not installed on the server."
[ -f "$APP_DIR/.env" ] || log "WARNING: $APP_DIR/.env is missing. The app needs it (copy .env.example and fill it in)."

cd "$APP_DIR"
APP_PARTS=(server shared dist package.json package-lock.json)
BACKUP="$APP_DIR/.deploy-backup"

# Port for the health check: PORT from .env, else 4000.
PORT="$(grep -E '^[[:space:]]*PORT[[:space:]]*=' .env 2>/dev/null | tail -1 | cut -d= -f2- | tr -d "[:space:]\"'" || true)"
PORT="${PORT:-4000}"

restart_app() {
  if [ -n "$RESTART_COMMAND" ]; then
    log "Restarting with custom command"
    bash -c "$RESTART_COMMAND"
  elif command -v pm2 >/dev/null && pm2 describe "$APP_NAME" >/dev/null 2>&1; then
    log "Restarting pm2 process '$APP_NAME'"
    pm2 restart "$APP_NAME" --update-env >/dev/null
  elif command -v systemctl >/dev/null && systemctl list-unit-files "$APP_NAME.service" --no-legend 2>/dev/null | grep -q "$APP_NAME"; then
    log "Restarting systemd service '$APP_NAME'"
    sudo -n systemctl restart "$APP_NAME"
  elif command -v pm2 >/dev/null; then
    log "No pm2 process '$APP_NAME' yet: starting it"
    pm2 start server/index.js --name "$APP_NAME" --cwd "$APP_DIR" >/dev/null
    pm2 save >/dev/null || true
  else
    fail "Don't know how to restart the app: no pm2 and no systemd service '$APP_NAME'. Set DEPLOY_RESTART_COMMAND."
  fi
}

healthy() {
  for _ in $(seq 1 30); do
    if curl -fsS --max-time 3 "http://127.0.0.1:$PORT/api/health" 2>/dev/null | grep -q '"ok":true'; then return 0; fi
    sleep 2
  done
  return 1
}

install_packages() {
  # Production packages only: the web app was already built by GitHub Actions.
  npm ci --omit=dev --no-audit --no-fund --loglevel=error
}

log "Deploying commit $COMMIT to $APP_DIR (app '$APP_NAME', port $PORT)"

# 1. Back up the current version (if there is one).
HAVE_BACKUP=false
rm -rf "$BACKUP"
if [ -d server ]; then
  mkdir -p "$BACKUP"
  for part in "${APP_PARTS[@]}"; do if [ -e "$part" ]; then cp -a "$part" "$BACKUP/"; fi; done
  HAVE_BACKUP=true
  log "Backed up the current version"
fi

rollback() {
  trap - ERR
  if [ "$HAVE_BACKUP" != true ]; then fail "Deploy failed and there is no previous version to restore."; fi
  log "Deploy failed: restoring the previous version"
  for part in "${APP_PARTS[@]}"; do rm -rf "$part"; if [ -e "$BACKUP/$part" ]; then cp -a "$BACKUP/$part" .; fi; done
  install_packages || log "WARNING: npm install of the previous version had problems"
  restart_app || true
  if healthy; then log "Previous version is running again. Check the GitHub Actions log for what went wrong."; else log "WARNING: previous version also failed its health check. Check the server now."; fi
  exit 1
}
trap rollback ERR

# 2. Unpack the new version (server code, shared code, built web app, package files).
for part in server shared dist; do rm -rf "$part"; done
tar xzf "$RELEASE_TGZ" -C "$APP_DIR" server shared dist package.json package-lock.json
log "Unpacked the new version"

# 3. Install packages.
install_packages
log "Installed packages"

# 4. Restart.
restart_app

# 5. Health check.
if ! healthy; then
  log "Health check failed on http://127.0.0.1:$PORT/api/health"
  false # triggers rollback
fi

trap - ERR
log "Deployed $COMMIT successfully. The app is healthy."
