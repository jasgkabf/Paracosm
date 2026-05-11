#Requires -Version 5.1
$ErrorActionPreference = "Stop"

$ProjectName = "Paracosm"
$DefaultPort = 7529

function Write-Info($msg)  { Write-Host "[INFO] " -ForegroundColor Cyan -NoNewline; Write-Host $msg }
function Write-Ok($msg)    { Write-Host "[OK]   " -ForegroundColor Green -NoNewline; Write-Host $msg }
function Write-Warn($msg)  { Write-Host "[WARN] " -ForegroundColor Yellow -NoNewline; Write-Host $msg }
function Write-Err($msg)   { Write-Host "[ERROR]" -ForegroundColor Red -NoNewline; Write-Host $msg }

function Check-Node {
    try {
        $v = (node -v) -replace 'v','' -split '\.' | Select-Object -First 1
        if ([int]$v -ge 20) {
            Write-Ok "Node.js $(node -v) detected"
            return $true
        } else {
            Write-Err "Node.js $(node -v) found, but >= 20.0.0 required"
            return $false
        }
    } catch {
        Write-Err "Node.js not found. Install Node.js >= 20.0.0 from https://nodejs.org/"
        return $false
    }
}

function Check-Pnpm {
    try {
        $null = Get-Command pnpm -ErrorAction Stop
        Write-Ok "pnpm $(pnpm -v) detected"
        return $true
    } catch {
        Write-Warn "pnpm not found, installing..."
        try {
            npm install -g pnpm
            Write-Ok "pnpm installed via npm"
            return $true
        } catch {
            Write-Err "Cannot install pnpm. Run: npm install -g pnpm"
            return $false
        }
    }
}

function Install-Deps {
    Write-Info "Installing dependencies..."
    try {
        pnpm install --frozen-lockfile 2>$null
    } catch {
        pnpm install
    }
    Write-Ok "Dependencies installed"
}

function Build-Project {
    Write-Info "Building all packages..."
    pnpm build
    Write-Ok "Build complete"
}

function Create-Env {
    if (-not (Test-Path .env)) {
        Write-Info "Creating default .env file..."
        @"
PARACOSM_PORT=$DefaultPort
PARACOSM_HOST=0.0.0.0
PARACOSM_NODE_ENV=production
"@ | Out-File -Encoding utf8 .env
        Write-Ok ".env created with default settings"
    } else {
        Write-Ok ".env already exists, skipping"
    }
}

function Start-Server {
    param([switch]$Detach)

    Write-Info "Starting $ProjectName server on port $DefaultPort..."
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  $ProjectName is running!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  Web:  http://localhost:$DefaultPort" -ForegroundColor Cyan
    Write-Host "  API:  http://localhost:$DefaultPort/api/v1" -ForegroundColor Cyan
    Write-Host "  WS:   ws://localhost:$DefaultPort/ws" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""

    if ($Detach) {
        Start-Process -FilePath "pnpm" -ArgumentList "start" -WindowStyle Hidden -RedirectStandardOutput "paracosm.log" -RedirectStandardError "paracosm-err.log"
        Write-Ok "Server started in background"
        Write-Ok "Log file: paracosm.log"
    } else {
        pnpm start
    }
}

Write-Host ""
Write-Host "  ____                      _            " -ForegroundColor Cyan
Write-Host " |  _ \ __ _ _ __ __ _  ___| |_ ___ _ __ " -ForegroundColor Cyan
Write-Host " | |_) / _`` | '__/ _`` |/ __| __/ _ \ '__|" -ForegroundColor Cyan
Write-Host " |  __/ (_| | | | (_| | (__| ||  __/ |   " -ForegroundColor Cyan
Write-Host " |_|   \__,_|_|  \__,_|\___|\__\___|_|   " -ForegroundColor Cyan
Write-Host ""
Write-Host "  Quick Start Script v1.0"
Write-Host ""

if (-not (Check-Node)) { exit 1 }
if (-not (Check-Pnpm)) { exit 1 }
Install-Deps
Build-Project
Create-Env

if ($args -contains "-d" -or $args -contains "--detach") {
    Start-Server -Detach
} else {
    Start-Server
}
