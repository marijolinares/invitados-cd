# Ejecuta smoke tests y los casos de prueba de aceptación contra un entorno local.
# Uso: .\scripts\windows\probar-entorno.ps1 -Entorno staging
param([ValidateSet('staging', 'production')][string]$Entorno = 'staging')
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\comun.ps1"

$url = Get-UrlEntorno $Entorno
$envFile = Get-ArchivoEnv $Entorno
$fallos = 0

function Revisar($nombre, $ruta, $esperado, $contiene) {
  try {
    $r = Invoke-WebRequest "$url$ruta" -UseBasicParsing -TimeoutSec 5
    $estado = [int]$r.StatusCode; $cuerpo = $r.Content
  } catch {
    $estado = [int]$_.Exception.Response.StatusCode; $cuerpo = ''
  }
  if ($estado -ne $esperado) { Falla "${nombre}: esperado $esperado, llegó $estado"; $script:fallos++ }
  elseif ($contiene -and ($cuerpo -notmatch [regex]::Escape($contiene))) { Falla "${nombre}: no contiene '$contiene'"; $script:fallos++ }
  else { Ok $nombre }
}

Info "Smoke tests contra $url"
Revisar 'Liveness /health'     '/health'        200 '"estado":"ok"'
Revisar 'Readiness /ready'     '/ready'         200 '"estado":"listo"'
Revisar 'Versión /api/version' '/api/version'   200 '"version"'
Revisar 'Métricas /metrics'    '/metrics'       200 'http_requests_total'
Revisar 'Página principal'     '/'              200 'Iniciar sesi'
Revisar 'Ruta inexistente'     '/api/no-existe' 404 ''
if ($fallos -gt 0) { throw "$fallos smoke test(s) fallaron" }

Info 'Casos de prueba de aceptación (CP-01 a CP-06)'
$env:BASE_URL = $url
$env:ADMIN_USER = Get-EnvValor $envFile 'ADMIN_USER'
$env:ADMIN_PASSWORD = Get-EnvValor $envFile 'ADMIN_PASSWORD'
Push-Location $Raiz
try {
  New-Item -ItemType Directory -Force reportes | Out-Null
  node --test --test-concurrency=1 `
    --test-reporter=spec --test-reporter-destination=stdout `
    --test-reporter=junit --test-reporter-destination=reportes/aceptacion.xml `
    "test/aceptacion/*.test.js"
  if ($LASTEXITCODE -ne 0) { throw 'Los casos de prueba fallaron' }
} finally {
  Pop-Location
  Remove-Item Env:BASE_URL, Env:ADMIN_PASSWORD -ErrorAction SilentlyContinue
}
Ok 'Entorno verificado. Reporte en reportes/aceptacion.xml'
