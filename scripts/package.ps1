$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$outputs = Join-Path $root 'outputs'
New-Item -ItemType Directory -Force -Path $outputs | Out-Null
$repositoryZip = Join-Path $outputs 'rudder-social-agent-repository.zip'
$extensionZip = Join-Path $outputs 'rudder-social-agent-extension.zip'
if (Test-Path $repositoryZip) { Remove-Item -LiteralPath $repositoryZip }
if (Test-Path $extensionZip) { Remove-Item -LiteralPath $extensionZip }
$staging = Join-Path $env:TEMP ('rudder-package-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $staging | Out-Null
try {
  Get-ChildItem -LiteralPath $root -Force | Where-Object { $_.Name -notin @('node_modules','.git','.next','dist','release','outputs','work','.env','.env.local') } | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $staging -Recurse -Force }
  Get-ChildItem -LiteralPath $staging -Directory -Recurse | Where-Object { $_.Name -in @('node_modules','.next','dist','release','coverage','test-results','playwright-report','.temp','.branches') } | Sort-Object FullName -Descending | ForEach-Object { Remove-Item -LiteralPath $_.FullName -Recurse -Force }
  Get-ChildItem -LiteralPath $staging -File -Recurse -Force | Where-Object { $_.Name -eq '.env' -or $_.Name -eq '.env.local' -or $_.Name -like '.env.*.local' -or $_.Name -like '*.tsbuildinfo' } | ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force }
  Compress-Archive -Path (Join-Path $staging '*') -DestinationPath $repositoryZip -CompressionLevel Optimal
  $extensionDist = Join-Path $root 'apps\chrome-extension\dist'
  if (-not (Test-Path $extensionDist)) { throw 'Build the Chrome extension before packaging.' }
  Compress-Archive -Path (Join-Path $extensionDist '*') -DestinationPath $extensionZip -CompressionLevel Optimal
} finally { if (Test-Path $staging) { Remove-Item -LiteralPath $staging -Recurse -Force } }
Write-Output $repositoryZip
Write-Output $extensionZip
