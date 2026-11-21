#!/usr/bin/env bash
# Despliegue a producción en Render (servicio web "Existing Image" que apunta a GHCR).
# Lo usa el job "produccion" del pipeline.
#
# Variables requeridas:
#   RENDER_DEPLOY_HOOK_URL  Deploy hook del servicio (secreto de GitHub, entorno production)
#   PROD_URL                URL pública, p. ej. https://invitados-cd.onrender.com
#   IMAGEN                  Imagen exacta a desplegar, p. ej. ghcr.io/marijolinares/invitados-cd:1.0.15
#   VERSION                 Versión esperada en /api/version
set -euo pipefail
source "$(dirname "$0")/../lib.sh"

: "${RENDER_DEPLOY_HOOK_URL:?Falta el secreto RENDER_DEPLOY_HOOK_URL}"
: "${PROD_URL:?Falta la variable PROD_URL}"
: "${IMAGEN:?Falta IMAGEN}"
: "${VERSION:?Falta VERSION}"
ESPERA_MAX="${ESPERA_MAX:-600}"   # Render puede tardar varios minutos en el plan gratuito

# Render exige el parámetro imgURL codificado en URL (':' -> %3A, '/' -> %2F, '@' -> %40)
IMG_CODIFICADA="$(printf '%s' "$IMAGEN" | sed -e 's/%/%25/g' -e 's/\//%2F/g' -e 's/:/%3A/g' -e 's/@/%40/g')"

info "Solicitando despliegue de $IMAGEN en Render"
estado="$(curl -sS -o /tmp/render.json -w '%{http_code}' -X POST "${RENDER_DEPLOY_HOOK_URL}&imgURL=${IMG_CODIFICADA}")"
if [[ "$estado" != "200" && "$estado" != "201" && "$estado" != "202" ]]; then
  error "Render respondió HTTP $estado: $(cat /tmp/render.json)"
  exit 1
fi
ok "Render aceptó el despliegue: $(cat /tmp/render.json)"

info "Esperando a que producción reporte la versión $VERSION (máx. ${ESPERA_MAX}s)"
inicio=$(date +%s)
while true; do
  actual="$(curl -fsS --max-time 10 "$PROD_URL/api/version" 2>/dev/null | sed -E 's/.*"version":"([^"]+)".*/\1/' || true)"
  [[ "$actual" == "$VERSION" ]] && break
  if (( $(date +%s) - inicio >= ESPERA_MAX )); then
    error "Producción sigue en '${actual:-sin respuesta}' después de ${ESPERA_MAX}s"
    exit 1
  fi
  sleep 15
done
ok "Producción corre la versión $VERSION"

"$RAIZ/scripts/pruebas/smoke-test.sh" "$PROD_URL" "$VERSION"
