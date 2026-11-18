$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
Set-Location (Join-Path $taskRoot 'backend')
if (-not (Test-Path '.venv\Scripts\python.exe')) { python -m venv .venv }
& .venv\Scripts\python.exe -m pip install -r requirements.txt
if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
if (-not (Test-Path '.env')) {
    $taskBytes = New-Object byte[] 48
    $taskRng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $taskRng.GetBytes($taskBytes)
    $taskRng.Dispose()
    $taskSecret = [Convert]::ToBase64String($taskBytes)
    (Get-Content -Raw '.env.example').Replace('REPLACE_WITH_AT_LEAST_32_RANDOM_CHARACTERS', $taskSecret) | Set-Content -Encoding UTF8 '.env'
}
Write-Host 'Backend prepared. Edit backend/.env with your MariaDB credentials, start MySQL in XAMPP, and apply Alembic migrations.'
