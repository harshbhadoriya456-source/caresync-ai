$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($env:DATABASE_URL)) {
  throw "Set DATABASE_URL to a disposable local Supabase PostgreSQL connection."
}

$psql = Get-Command psql -ErrorAction Stop
$pgbench = Get-Command pgbench -ErrorAction Stop
$setup = Join-Path $PSScriptRoot "concurrent_invitation_setup.sql"
$script = Join-Path $PSScriptRoot "concurrent_invitation_redemption.pgbench"
$assert = Join-Path $PSScriptRoot "concurrent_invitation_assert.sql"

& $psql.Source $env:DATABASE_URL "-v" "ON_ERROR_STOP=1" "-f" $setup
if ($LASTEXITCODE -ne 0) {
  throw "Concurrent invitation test setup failed."
}

& $pgbench.Source $env:DATABASE_URL "-n" "-c" "2" "-j" "2" "-t" "1" "-f" $script
if ($LASTEXITCODE -ne 0) {
  throw "Concurrent invitation redemption run failed."
}

& $psql.Source $env:DATABASE_URL "-v" "ON_ERROR_STOP=1" "-f" $assert
if ($LASTEXITCODE -ne 0) {
  throw "Concurrent invitation redemption assertion failed."
}
