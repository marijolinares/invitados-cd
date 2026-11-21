# invitados-cd — Liberación y despliegue continuo

Caso de estudio: **sistema de registro de invitados** para el Congreso de Tecnología UTT.
El administrador inicia sesión, registra invitados (nombre, apellidos, biografía e imagen) y consulta la lista.
El objetivo del repositorio es el **pipeline de liberación y despliegue continuo** alrededor de esa app.

Autora: Maria Jose Linares Cortes · Grupo 10 B

## Estructura

```
.github/workflows/pipeline.yml      Pipeline CD (GitHub Actions)
Dockerfile, .dockerignore           Imagen de la aplicación
deploy/
  docker-compose.yml                Definición del entorno (app + Prometheus)
  .env.staging.example              Parámetros del entorno de liberación
  .env.production.example           Parámetros de producción
  prometheus/prometheus.yml         Recolección de métricas
  prometheus/alertas.yml            Alertas alineadas con los niveles de servicio
scripts/
  entorno/crear-entorno.sh          Genera el entorno de liberación o producción
  entorno/destruir-entorno.sh       Elimina el entorno
  pruebas/esperar-salud.sh          Espera /health y /ready
  pruebas/smoke-test.sh             Pruebas de humo después de cada despliegue
  pruebas/pruebas-aceptacion.sh     Casos de prueba CP-01..CP-06 contra un entorno
  pruebas/verificar-monitoreo.sh    Comprueba que Prometheus recolecta métricas
  pruebas/lint.js                   Análisis estático
  despliegue/desplegar.sh           Despliegue con verificación y rollback automático
  despliegue/rollback.sh            Regresa a la versión anterior
  despliegue/desplegar-render.sh    Despliegue a producción en Render
  windows/*.ps1                     Versiones en PowerShell para trabajar en local
src/, public/                       Aplicación (Node.js + Express)
test/unit/                          Pruebas unitarias
test/aceptacion/                    Casos de prueba automatizados
docs/casos-de-prueba.md             Casos de prueba con el formato de la plantilla
```

## Flujo del pipeline

```
push / pull request a main
   │
   ▼
1. Integración ──► 2. Construcción ──► 3. Liberación (staging) ──► 4. Producción
   lint             imagen Docker        entorno efímero            aprobación manual
   npm audit        versión 1.0.N        smoke tests                Render (imagen exacta)
   unitarias        push a GHCR          casos de prueba            smoke tests
   aceptación                            monitoreo + rollback       release vN en GitHub
```

En los pull requests corren los pasos 1 a 3. En `main` corre todo y producción espera la aprobación.

## Uso local en Windows (PowerShell, VS Code)

Requisitos: Node.js 22, Docker Desktop encendido y Git.

```powershell
npm install
npm test                                                       # unitarias + aceptación en memoria
.\scripts\windows\crear-entorno.ps1 -Entorno staging -Construir -Monitoreo
.\scripts\windows\probar-entorno.ps1 -Entorno staging          # smoke + CP-01..CP-06
# Abrir http://localhost:8081 (usuario admin, contraseña en deploy\.env.staging)
# Prometheus en http://localhost:9091
.\scripts\windows\destruir-entorno.ps1 -Entorno staging -BorrarDatos
```

Los scripts `.sh` también corren en Windows desde **Git Bash**.

## Configurar GitHub (una sola vez)

1. Crear el repositorio `invitados-cd` en GitHub y subir el código:
   ```powershell
   git remote add origin https://github.com/marijolinares/invitados-cd.git
   git push -u origin main
   ```
2. **Settings › Environments › New environment › `staging`.**
   Secreto opcional `STAGING_ADMIN_PASSWORD` (si no existe, el script genera una aleatoria).
3. **Settings › Environments › New environment › `production`.**
   - Activar *Required reviewers* y agregarte como revisora (aprobación manual).
   - *Deployment branches*: solo `main`.
   - Secreto `RENDER_DEPLOY_HOOK_URL` y variable `PROD_URL` (siguiente sección).
4. Después del primer push a `main`, en **Packages** abrir `invitados-cd` › *Package settings* › *Change visibility* › **Public**, para que Render pueda descargar la imagen.

## Configurar Render (producción)

1. En render.com: **New › Web Service › Existing Image**.
2. Image URL: `ghcr.io/marijolinares/invitados-cd:latest`.
3. Variables de entorno: `APP_ENV=production`, `ADMIN_USER=admin`, `ADMIN_PASSWORD=<clave segura>`, `DATA_DIR=/data`.
4. *Health Check Path*: `/health`.
5. En *Settings › Deploy Hook* copiar la URL y guardarla como secreto `RENDER_DEPLOY_HOOK_URL` del entorno `production` en GitHub.
6. Guardar la URL pública del servicio (por ejemplo `https://invitados-cd.onrender.com`) como variable `PROD_URL`.

> En el plan gratuito de Render el servicio se duerme tras 15 minutos sin tráfico y los archivos subidos se pierden al reiniciar.
> Para conservar datos se necesita un plan de pago con disco persistente montado en `/data`,
> o desplegar con `scripts/despliegue/desplegar.sh production <imagen>` en un servidor propio con Docker.

## Endpoints

| Ruta | Uso |
|---|---|
| `GET /health` | Liveness (el proceso responde) |
| `GET /ready` | Readiness (el volumen de datos se puede escribir) |
| `GET /metrics` | Métricas en formato Prometheus |
| `GET /api/version` | Versión, commit y entorno desplegados |
| `POST /api/login` | Inicio de sesión del administrador |
| `GET /api/invitados` | Lista de invitados |
| `POST /api/invitados` | Alta de invitado (multipart, requiere token) |
| `DELETE /api/invitados/:id` | Baja de invitado (requiere token) |
