#!/usr/bin/env bash
# Espera a que /health y /ready respondan 200.
# Uso: scripts/pruebas/esperar-salud.sh <url-base> [segundos-maximos]
set -euo pipefail
source "$(dirname "$0")/../lib.sh"

URL="${1:?Uso: $0 <url-base> [segundos]}"
MAXIMO="${2:-60}"
inicio=$(date +%s)

until curl -fsS --max-time 3 "$URL/health" >/dev/null 2>&1 && curl -fsS --max-time 3 "$URL/ready" >/dev/null 2>&1; do
  if (( $(date +%s) - inicio >= MAXIMO )); then
    error "La aplicación en $URL no estuvo sana después de ${MAXIMO}s"
    exit 1
  fi
  sleep 2
done
ok "Aplicación sana en $URL ($(( $(date +%s) - inicio ))s)"
