#!/usr/bin/env bash
# Verifica que Prometheus esté recolectando las métricas de la app y que cargó las reglas de alerta.
# Uso: scripts/pruebas/verificar-monitoreo.sh <staging|production>
set -euo pipefail
source "$(dirname "$0")/../lib.sh"

ENTORNO="${1:?Uso: $0 <staging|production>}"
PROM="http://localhost:$(leer_env "$(archivo_env "$ENTORNO")" PROM_PORT)"

info "Esperando a que Prometheus recolecte la app ($PROM)"
for _ in $(seq 1 20); do
  if curl -fsS "$PROM/api/v1/query?query=up%7Bjob%3D%22invitados-app%22%7D" | grep -q '"value":\[[^]]*,"1"\]'; then
    ok "Prometheus recolecta /metrics (up = 1)"
    break
  fi
  sleep 3
done
curl -fsS "$PROM/api/v1/query?query=up%7Bjob%3D%22invitados-app%22%7D" | grep -q '"value":\[[^]]*,"1"\]' \
  || { error "Prometheus no logró recolectar la app"; exit 1; }

reglas="$(curl -fsS "$PROM/api/v1/rules" | grep -o '"name":"[A-Za-z0-9]*"' | grep -vc niveles-de-servicio || true)"
if (( reglas >= 5 )); then
  ok "Reglas de alerta cargadas: $reglas"
else
  error "Se esperaban 5 reglas de alerta y hay $reglas"
  exit 1
fi

for metrica in app_info http_requests_total invitados_registrados; do
  curl -fsS "$PROM/api/v1/query?query=$metrica" | grep -q '"result":\[{' \
    && ok "Métrica disponible: $metrica" \
    || { error "No se encontró la métrica $metrica"; exit 1; }
done
