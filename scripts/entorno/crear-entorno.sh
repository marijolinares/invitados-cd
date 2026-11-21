#!/usr/bin/env bash
# Genera el entorno de liberación (staging) o de producción con Docker Compose.
#
# Uso:  scripts/entorno/crear-entorno.sh <staging|production> [imagen] [--monitoreo]
#   imagen       Imagen a ejecutar (por defecto la definida en el .env del entorno)
#   --monitoreo  Levanta también Prometheus con las reglas de alerta
#
# Variables opcionales: ADMIN_PASSWORD (si se define, sobrescribe la del .env; así lo usa CI con un secreto)
set -euo pipefail
source "$(dirname "$0")/../lib.sh"

ENTORNO="${1:-}"
IMAGEN="${2:-}"
MONITOREO="no"
for arg in "$@"; do [[ "$arg" == "--monitoreo" ]] && MONITOREO="si"; done
[[ "$IMAGEN" == "--monitoreo" ]] && IMAGEN=""

[[ -z "$ENTORNO" ]] && { error "Uso: $0 <staging|production> [imagen] [--monitoreo]"; exit 2; }
ENV_FILE="$(archivo_env "$ENTORNO")"

info "1/5 Verificando requisitos"
command -v docker >/dev/null || { error "Docker no está instalado"; exit 1; }
docker compose version >/dev/null || { error "Falta el plugin docker compose v2"; exit 1; }
docker info >/dev/null 2>&1 || { error "El demonio de Docker no está corriendo"; exit 1; }
ok "Docker $(docker version --format '{{.Server.Version}}') y $(docker compose version --short)"

info "2/5 Preparando configuración de $ENTORNO ($ENV_FILE)"
if [[ ! -f "$ENV_FILE" ]]; then
  cp "$ENV_FILE.example" "$ENV_FILE"
  aviso "Se creó $ENV_FILE a partir del ejemplo"
fi
[[ -n "$IMAGEN" ]] && fijar_env "$ENV_FILE" IMAGE "$IMAGEN"
if [[ -n "${ADMIN_PASSWORD:-}" ]]; then
  fijar_env "$ENV_FILE" ADMIN_PASSWORD "$ADMIN_PASSWORD"
elif [[ "$(leer_env "$ENV_FILE" ADMIN_PASSWORD)" == cambia-esta-clave* ]]; then
  # Contraseña aleatoria para no dejar la del ejemplo
  fijar_env "$ENV_FILE" ADMIN_PASSWORD "$(head -c 18 /dev/urandom | base64 | tr -d '/+=')"
  aviso "Se generó una ADMIN_PASSWORD aleatoria en $ENV_FILE"
fi
compose "$ENTORNO" config --quiet
ok "Configuración válida (imagen: $(leer_env "$ENV_FILE" IMAGE))"

info "3/5 Obteniendo la imagen"
IMG="$(leer_env "$ENV_FILE" IMAGE)"
if docker image inspect "$IMG" >/dev/null 2>&1; then
  ok "La imagen $IMG ya existe localmente"
else
  docker pull "$IMG"
fi

info "4/5 Levantando servicios"
PERFILES=()
[[ "$MONITOREO" == "si" ]] && PERFILES=(--profile monitoreo)
compose "$ENTORNO" "${PERFILES[@]}" up -d --remove-orphans

info "5/5 Esperando a que la aplicación esté sana"
"$RAIZ/scripts/pruebas/esperar-salud.sh" "$(url_entorno "$ENTORNO")" 60

compose "$ENTORNO" ps
ok "Entorno $ENTORNO listo en $(url_entorno "$ENTORNO")"
[[ "$MONITOREO" == "si" ]] && ok "Prometheus en http://localhost:$(leer_env "$ENV_FILE" PROM_PORT)"
exit 0
