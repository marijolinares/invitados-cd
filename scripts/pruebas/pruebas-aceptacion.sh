#!/usr/bin/env bash
# Ejecuta los casos de prueba automatizados (CP-01 a CP-06) contra un entorno ya desplegado
# y deja un reporte JUnit en reportes/ para publicarlo en GitHub Actions.
#
# Uso: scripts/pruebas/pruebas-aceptacion.sh <staging|production|url> [version-esperada]
set -euo pipefail
source "$(dirname "$0")/../lib.sh"

DESTINO="${1:?Uso: $0 <staging|production|url> [version-esperada]}"
if [[ "$DESTINO" == http* ]]; then
  BASE_URL="$DESTINO"
else
  BASE_URL="$(url_entorno "$DESTINO")"
  ENV_FILE="$(archivo_env "$DESTINO")"
  export ADMIN_USER="${ADMIN_USER:-$(leer_env "$ENV_FILE" ADMIN_USER)}"
  export ADMIN_PASSWORD="${ADMIN_PASSWORD:-$(leer_env "$ENV_FILE" ADMIN_PASSWORD)}"
fi
export BASE_URL
[[ -n "${2:-}" ]] && export EXPECTED_VERSION="$2"

mkdir -p "$RAIZ/reportes"
info "Casos de prueba de aceptación contra $BASE_URL"
cd "$RAIZ"
node --test \
  --test-concurrency=1 \
  --test-reporter=spec --test-reporter-destination=stdout \
  --test-reporter=junit --test-reporter-destination=reportes/aceptacion.xml \
  "test/aceptacion/*.test.js"
ok "Casos de prueba aprobados. Reporte: reportes/aceptacion.xml"
