# Genera el entorno de liberación en Windows con Docker Desktop.
# Uso (desde la raíz del repo):
#   .\scripts\windows\crear-entorno.ps1 -Entorno staging -Construir -Monitoreo
#   .\scripts\windows\crear-entorno.ps1 -Entorno production -Imagen ghcr.io/marijolinares/invitados-cd:1.0.5
param(
  [ValidateSet('staging', 'production')][string]$Entorno = 'staging',
  [string]$Imagen = '',
  [switch]$Construir,   # construye la imagen local desde el Dockerfile
  [switch]$Monitoreo    # levanta también Prometheus
)
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\comun.ps1"

Info '1/5 Verificando requisitos'
if (-not (Test-Comando { docker info })) { throw 'Docker Desktop no está corriendo' }
Ok 'Docker disponible'

Info "2/5 Preparando configuración de $Entorno"
$envFile = Get-ArchivoEnv $Entorno
if (-not (Test-Path $envFile)) {
  Copy-Item "$envFile.example" $envFile
  Aviso "Se creó $envFile a partir del ejemplo"
}
if ((Get-EnvValor $envFile 'ADMIN_PASSWORD') -like 'cambia-esta-clave*') {
  $clave = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 20 | ForEach-Object { [char]$_ })
  Set-EnvValor $envFile 'ADMIN_PASSWORD' $clave
  Aviso "Se generó una ADMIN_PASSWORD aleatoria en $envFile"
}

if ($Construir) {
  Info 'Construyendo imagen local invitados-cd:local'
  docker build --build-arg APP_VERSION=local -t invitados-cd:local $Raiz
  if ($LASTEXITCODE -ne 0) { throw 'docker build falló' }
  $Imagen = 'invitados-cd:local'
}
if ($Imagen) { Set-EnvValor $envFile 'IMAGE' $Imagen }
Invoke-Compose $Entorno @('config', '--quiet')
Ok "Configuración válida (imagen: $(Get-EnvValor $envFile 'IMAGE'))"

Info '3/5 Obteniendo la imagen'
$img = Get-EnvValor $envFile 'IMAGE'
if (-not (Test-Comando { docker image inspect $img })) { docker pull $img; if ($LASTEXITCODE -ne 0) { throw "No se pudo descargar $img" } }

Info '4/5 Levantando servicios'
$args_ = @()
if ($Monitoreo) { $args_ += @('--profile', 'monitoreo') }
Invoke-Compose $Entorno ($args_ + @('up', '-d', '--remove-orphans'))

Info '5/5 Esperando a que la aplicación esté sana'
Wait-Salud (Get-UrlEntorno $Entorno) 60
Invoke-Compose $Entorno @('ps')
Ok "Entorno $Entorno listo en $(Get-UrlEntorno $Entorno)"
Ok "Usuario: $(Get-EnvValor $envFile 'ADMIN_USER') / contraseña en $envFile"
if ($Monitoreo) { Ok "Prometheus en http://localhost:$(Get-EnvValor $envFile 'PROM_PORT')" }
