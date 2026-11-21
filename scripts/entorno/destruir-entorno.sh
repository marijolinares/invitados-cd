#!/usr/bin/env bash
# Elimina un entorno. Por defecto conserva los volúmenes (datos).
# Uso: scripts/entorno/destruir-entorno.sh <staging|production> [--borrar-datos]
set -euo pipefail
source "$(dirname "$0")/../lib.sh"

ENTORNO="${1:-}"
[[ -z "$ENTORNO" ]] && { error "Uso: $0 <staging|production> [--borrar-datos]"; exit 2; }
archivo_env "$ENTORNO" >/dev/null

if [[ "${2:-}" == "--borrar-datos" ]]; then
  [[ "$ENTORNO" == "production" && "${CONFIRMAR:-}" != "si" ]] && {
    error "Para borrar datos de producción ejecuta con CONFIRMAR=si"; exit 1; }
  compose "$ENTORNO" --profile monitoreo down --volumes --remove-orphans
  ok "Entorno $ENTORNO eliminado junto con sus datos"
else
  compose "$ENTORNO" --profile monitoreo down --remove-orphans
  ok "Entorno $ENTORNO detenido (datos conservados)"
fi
