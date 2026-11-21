# Funciones comunes para los scripts de Windows (PowerShell 5.1+ / 7+).
# Equivalen a scripts/lib.sh para trabajar en local desde la terminal de VS Code.

$Script:Raiz = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$Script:ComposeFile = Join-Path $Raiz 'deploy\docker-compose.yml'

function Info($m)  { Write-Host "[INFO] $m" -ForegroundColor Cyan }
function Ok($m)    { Write-Host "[ OK ] $m" -ForegroundColor Green }
function Aviso($m) { Write-Host "[WARN] $m" -ForegroundColor Yellow }
function Falla($m) { Write-Host "[FAIL] $m" -ForegroundColor Red }

function Get-ArchivoEnv([string]$Entorno) {
  if ($Entorno -notin @('staging', 'production')) { throw "Entorno no válido: $Entorno (usa staging o production)" }
  return Join-Path $Raiz "deploy\.env.$Entorno"
}

function Get-EnvValor([string]$Archivo, [string]$Clave) {
  $linea = Get-Content $Archivo | Where-Object { $_ -match "^$Clave=" } | Select-Object -Last 1
  if ($linea) { return $linea.Substring($Clave.Length + 1) }
  return ''
}

function Set-EnvValor([string]$Archivo, [string]$Clave, [string]$Valor) {
  $lineas = @(Get-Content $Archivo | Where-Object { $_ -notmatch "^$Clave=" })
  $lineas += "$Clave=$Valor"
  # UTF-8 sin BOM para que docker compose lo lea bien
  [IO.File]::WriteAllLines($Archivo, $lineas, (New-Object Text.UTF8Encoding $false))
}

function Invoke-Compose([string]$Entorno, [string[]]$Argumentos) {
  $envFile = Get-ArchivoEnv $Entorno
  $proyecto = Get-EnvValor $envFile 'COMPOSE_PROJECT_NAME'
  & docker compose -p $proyecto --env-file $envFile -f $ComposeFile @Argumentos
  if ($LASTEXITCODE -ne 0) { throw "docker compose $($Argumentos -join ' ') falló" }
}

function Get-UrlEntorno([string]$Entorno) {
  $puerto = Get-EnvValor (Get-ArchivoEnv $Entorno) 'HOST_PORT'
  return "http://localhost:$puerto"
}

function Wait-Salud([string]$Url, [int]$Maximo = 60) {
  $inicio = Get-Date
  while ($true) {
    try {
      Invoke-RestMethod "$Url/health" -TimeoutSec 3 | Out-Null
      Invoke-RestMethod "$Url/ready" -TimeoutSec 3 | Out-Null
      Ok "Aplicación sana en $Url"
      return
    } catch {
      if (((Get-Date) - $inicio).TotalSeconds -ge $Maximo) { throw "La aplicación en $Url no estuvo sana en ${Maximo}s" }
      Start-Sleep -Seconds 2
    }
  }
}

# Ejecuta un comando nativo descartando su salida y devuelve $true si terminó con código 0.
# Evita que Windows PowerShell 5.1 convierta la salida de error de docker en excepción.
function Test-Comando([scriptblock]$Bloque) {
  $previo = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try { & $Bloque *> $null; return ($LASTEXITCODE -eq 0) }
  finally { $ErrorActionPreference = $previo }
}
