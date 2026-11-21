#!/usr/bin/env bash
# Funciones comunes para todos los scripts.

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$RAIZ/deploy/docker-compose.yml"

info()  { printf '\033[1;34m[INFO]\033[0m %s\n' "$*"; }
ok()    { printf '\033[1;32m[ OK ]\033[0m %s\n' "$*"; }
aviso() { printf '\033[1;33m[WARN]\033[0m %s\n' "$*"; }
error() { printf '\033[1;31m[FAIL]\033[0m %s\n' "$*" >&2; }

# Valida el nombre del entorno y devuelve la ruta de su archivo .env
archivo_env() {
  local entorno="$1"
  case "$entorno" in
    staging|production) echo "$RAIZ/deploy/.env.$entorno" ;;
    *) error "Entorno no válido: '$entorno' (usa staging o production)"; exit 2 ;;
  esac
}

# Lee una variable de un archivo .env sin ejecutarlo
leer_env() {
  local archivo="$1" clave="$2"
  grep -E "^${clave}=" "$archivo" | tail -n1 | cut -d= -f2-
}

# Escribe o reemplaza una variable en un archivo .env
fijar_env() {
  local archivo="$1" clave="$2" valor="$3"
  if grep -qE "^${clave}=" "$archivo"; then
    local tmp; tmp="$(mktemp)"
    grep -vE "^${clave}=" "$archivo" > "$tmp"
    echo "${clave}=${valor}" >> "$tmp"
    mv "$tmp" "$archivo"
  else
    echo "${clave}=${valor}" >> "$archivo"
  fi
}

compose() {
  local entorno="$1"; shift
  local env_file; env_file="$(archivo_env "$entorno")"
  local proyecto; proyecto="$(leer_env "$env_file" COMPOSE_PROJECT_NAME)"
  docker compose -p "${proyecto:-invitados-$entorno}" --env-file "$env_file" -f "$COMPOSE_FILE" "$@"
}

url_entorno() {
  local entorno="$1"
  local puerto; puerto="$(leer_env "$(archivo_env "$entorno")" HOST_PORT)"
  echo "http://localhost:${puerto:-8080}"
}
