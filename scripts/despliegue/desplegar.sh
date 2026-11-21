#!/usr/bin/env bash
# Despliega una versión (imagen) en un entorno Docker Compose con verificación y rollback automático.
#
# Uso: scripts/despliegue/desplegar.sh <staging|production> <imagen> [version-esperada]
#
# Pasos:
#   1. Guarda la imagen que está corriendo (para poder regresar)
#   2. Descarga la nueva imagen y recrea el contenedor (los datos viven en el volumen)
#   3. Espera /health y /ready
#   4. Corre smoke tests
#   5. Si algo falla -> rollback a la imagen anterior
set -euo pipefail
source "$(dirname "$0")/../lib.sh"

ENTORNO="${1:-}"
IMAGEN="${2:-}"
VERSION="${3:-}"
[[ -z "$ENTORNO" || -z "$IMAGEN" ]] && { error "Uso: $0 <staging|production> <imagen> [version]"; exit 2; }
ENV_FILE="$(archivo_env "$ENTORNO")"
[[ -f "$ENV_FILE" ]] || { error "No existe $ENV_FILE. Ejecuta primero scripts/entorno/crear-entorno.sh $ENTORNO"; exit 1; }
URL="$(url_entorno "$ENTORNO")"
HISTORIAL="$RAIZ/deploy/.historial-$ENTORNO"

ANTERIOR="$(leer_env "$ENV_FILE" IMAGE)"
info "Desplegando $IMAGEN en $ENTORNO (actual: $ANTERIOR)"

if ! docker image inspect "$IMAGEN" >/dev/null 2>&1; then
  docker pull "$IMAGEN"
fi

fijar_env "$ENV_FILE" IMAGE "$IMAGEN"
compose "$ENTORNO" up -d --no-deps app

if "$RAIZ/scripts/pruebas/esperar-salud.sh" "$URL" 60 \
   && "$RAIZ/scripts/pruebas/smoke-test.sh" "$URL" "$VERSION"; then
  echo "$(date -u +%FT%TZ) $IMAGEN" >> "$HISTORIAL"
  ok "Despliegue exitoso de $IMAGEN en $ENTORNO ($URL)"
  exit 0
fi

error "El despliegue falló la verificación. Iniciando rollback a $ANTERIOR"
"$RAIZ/scripts/despliegue/rollback.sh" "$ENTORNO" "$ANTERIOR"
exit 1
