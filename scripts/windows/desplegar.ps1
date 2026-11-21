# Despliega una imagen en un entorno local con verificación y rollback automático.
# Uso: .\scripts\windows\desplegar.ps1 -Entorno production -Imagen ghcr.io/marijolinares/invitados-cd:1.0.5
param(
  [ValidateSet('staging', 'production')][string]$Entorno = 'production',
  [Parameter(Mandatory)][string]$Imagen
)
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\comun.ps1"

$envFile = Get-ArchivoEnv $Entorno
if (-not (Test-Path $envFile)) { throw "No existe $envFile. Ejecuta primero crear-entorno.ps1 -Entorno $Entorno" }
$anterior = Get-EnvValor $envFile 'IMAGE'
$url = Get-UrlEntorno $Entorno
Info "Desplegando $Imagen en $Entorno (actual: $anterior)"

if (-not (Test-Comando { docker image inspect $Imagen })) { docker pull $Imagen; if ($LASTEXITCODE -ne 0) { throw "No se pudo descargar $Imagen" } }

Set-EnvValor $envFile 'IMAGE' $Imagen
Invoke-Compose $Entorno @('up', '-d', '--no-deps', 'app')

try {
  Wait-Salud $url 60
  & "$PSScriptRoot\probar-entorno.ps1" -Entorno $Entorno
  Add-Content (Join-Path $Raiz "deploy\.historial-$Entorno") "$(Get-Date -Format s) $Imagen"
  Ok "Despliegue exitoso de $Imagen en $url"
} catch {
  Falla "Verificación fallida: $_"
  Aviso "Rollback a $anterior"
  Set-EnvValor $envFile 'IMAGE' $anterior
  Invoke-Compose $Entorno @('up', '-d', '--no-deps', 'app')
  Wait-Salud $url 60
  Ok "Rollback completado: $Entorno corre $anterior"
  exit 1
}
