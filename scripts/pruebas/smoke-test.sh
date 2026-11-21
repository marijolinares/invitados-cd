#!/usr/bin/env bash
# Pruebas de humo: verificación rápida de que el despliegue funciona.
# Se ejecutan después de CADA despliegue (staging y producción). Si fallan, se hace rollback.
#
# Uso: scripts/pruebas/smoke-test.sh <url-base> [version-esperada]
set -euo pipefail
source "$(dirname "$0")/../lib.sh"

URL="${1:?Uso: $0 <url-base> [version-esperada]}"
VERSION_ESPERADA="${2:-}"
fallos=0

revisar() {
  local nombre="$1" ruta="$2" estado_esperado="$3" contiene="${4:-}"
  local cuerpo estado
  cuerpo="$(mktemp)"
  estado="$(curl -sS -o "$cuerpo" -w '%{http_code}' --max-time 5 "$URL$ruta" || echo 000)"
  if [[ "$estado" != "$estado_esperado" ]]; then
    error "$nombre: se esperaba HTTP $estado_esperado y llegó $estado"
    fallos=$((fallos + 1))
  elif [[ -n "$contiene" ]] && ! grep -q "$contiene" "$cuerpo"; then
    error "$nombre: la respuesta no contiene '$contiene'"
    fallos=$((fallos + 1))
  else
    ok "$nombre"
  fi
  rm -f "$cuerpo"
}

info "Smoke tests contra $URL"
revisar "Liveness /health"            /health            200 '"estado":"ok"'
revisar "Readiness /ready"            /ready             200 '"estado":"listo"'
revisar "Versión /api/version"        /api/version       200 '"version"'
revisar "Métricas /metrics"           /metrics           200 'http_requests_total'
revisar "Página principal"            /                  200 'Iniciar sesión'
revisar "Listado de invitados"        /api/invitados     200 '\['
revisar "Ruta inexistente -> 404"     /api/no-existe     404

if [[ -n "$VERSION_ESPERADA" ]]; then
  actual="$(curl -fsS --max-time 5 "$URL/api/version" | sed -E 's/.*"version":"([^"]+)".*/\1/')"
  if [[ "$actual" == "$VERSION_ESPERADA" ]]; then
    ok "Versión desplegada = $VERSION_ESPERADA"
  else
    error "Versión desplegada '$actual' distinta de la esperada '$VERSION_ESPERADA'"
    fallos=$((fallos + 1))
  fi
fi

# Latencia: el SLO pide p95 < 500 ms dentro del servidor. Desde fuera se suma la red,
# por eso el umbral es configurable (LATENCIA_MAX, en segundos).
LATENCIA_MAX="${LATENCIA_MAX:-0.5}"
t="$(curl -o /dev/null -sS -w '%{time_total}' --max-time 5 "$URL/health")"
if awk -v t="$t" -v m="$LATENCIA_MAX" 'BEGIN { exit !(t < m) }'; then
  ok "Latencia /health = ${t}s (< ${LATENCIA_MAX}s)"
else
  error "Latencia /health = ${t}s (>= ${LATENCIA_MAX}s)"
  fallos=$((fallos + 1))
fi

if (( fallos > 0 )); then
  error "$fallos smoke test(s) fallaron"
  exit 1
fi
ok "Todos los smoke tests pasaron"
