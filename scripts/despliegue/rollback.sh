#!/usr/bin/env bash
# Regresa un entorno a una imagen anterior.
# Uso: scripts/despliegue/rollback.sh <staging|production> [imagen]
#   Sin imagen, usa la penúltima registrada en deploy/.historial-<entorno>
set -euo pipefail
source "$(dirname "$0")/../lib.sh"

ENTORNO="${1:?Uso: $0 <staging|production> [imagen]}"
ENV_FILE="$(archivo_env "$ENTORNO")"
HISTORIAL="$RAIZ/deploy/.historial-$ENTORNO"
IMAGEN="${2:-}"

if [[ -z "$IMAGEN" ]]; then
  [[ -f "$HISTORIAL" ]] && IMAGEN="$(tail -n2 "$HISTORIAL" | head -n1 | awk '{print $2}')"
  [[ -z "$IMAGEN" ]] && { error "No hay una versión anterior registrada en $HISTORIAL"; exit 1; }
fi

info "Rollback de $ENTORNO a $IMAGEN"
fijar_env "$ENV_FILE" IMAGE "$IMAGEN"
compose "$ENTORNO" up -d --no-deps app
"$RAIZ/scripts/pruebas/esperar-salud.sh" "$(url_entorno "$ENTORNO")" 60
echo "$(date -u +%FT%TZ) $IMAGEN rollback" >> "$HISTORIAL"
ok "Rollback completado: $ENTORNO corre $IMAGEN"
