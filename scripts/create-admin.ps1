<#
.SYNOPSIS
  Prompt-driven wrapper around `npm run admin:create` for Windows PowerShell.

  Asks for everything interactively (the database URL and the password are
  typed hidden), sets the variables only for this process, runs the guarded
  Node script, then clears them. Nothing is written to disk or to the shell
  history, and no value is ever echoed.

.USAGE
  powershell -ExecutionPolicy Bypass -File scripts\create-admin.ps1
#>

function Read-Secret([string]$Prompt) {
  $secure = Read-Host -Prompt $Prompt -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

Write-Host ""
Write-Host "Refnivo AI - create the bootstrap admin" -ForegroundColor Cyan
Write-Host "Values are typed hidden and used only for this run." -ForegroundColor DarkGray
Write-Host ""

$url = Read-Secret "Database URL (the DATABASE_URL value from Vercel, typed hidden)"
if (-not $url) { Write-Host "No database URL given - aborting." -ForegroundColor Red; exit 1 }

try {
  $host_ = ([Uri]$url).Host
} catch {
  Write-Host "That does not look like a valid postgresql:// URL - aborting." -ForegroundColor Red; exit 1
}
Write-Host "Target host: $host_" -ForegroundColor Yellow
$confirm = Read-Host "Type YES to confirm this is the database you want to create the admin in"
if ($confirm -ne "YES") { Write-Host "Not confirmed - aborting." -ForegroundColor Red; exit 1 }

$email = Read-Host "Admin e-mail"
$name = Read-Host "Admin display name"
$password = Read-Secret "Admin password (12+ chars, letter + number; typed hidden)"
$password2 = Read-Secret "Repeat the admin password"
if ($password -ne $password2) { Write-Host "Passwords do not match - aborting." -ForegroundColor Red; exit 1 }

$env:DATABASE_URL = $url
$env:ADMIN_BOOTSTRAP_CONFIRM = $host_
$env:ADMIN_EMAIL = $email
$env:ADMIN_NAME = $name
$env:ADMIN_PASSWORD = $password
$url = $null; $password = $null; $password2 = $null

try {
  & npm.cmd run admin:create
  $code = $LASTEXITCODE
} finally {
  Remove-Item Env:ADMIN_PASSWORD, Env:ADMIN_EMAIL, Env:ADMIN_NAME, Env:ADMIN_BOOTSTRAP_CONFIRM, Env:DATABASE_URL -ErrorAction SilentlyContinue
}
exit $code
