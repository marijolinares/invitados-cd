# Detiene un entorno local. Con -BorrarDatos también elimina los volúmenes.
# Uso: .\scripts\windows\destruir-entorno.ps1 -Entorno staging -BorrarDatos
param(
  [ValidateSet('staging', 'production')][string]$Entorno = 'staging',
  [switch]$BorrarDatos
)
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\comun.ps1"

$args_ = @('--profile', 'monitoreo', 'down', '--remove-orphans')
if ($BorrarDatos) {
  if ($Entorno -eq 'production') {
    $r = Read-Host 'Vas a borrar los datos de PRODUCCIÓN. Escribe "si" para confirmar'
    if ($r -ne 'si') { Aviso 'Cancelado'; exit 0 }
  }
  $args_ += '--volumes'
}
Invoke-Compose $Entorno $args_
Ok "Entorno $Entorno detenido$(if ($BorrarDatos) { ' y datos eliminados' })"
