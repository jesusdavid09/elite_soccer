Set-Location $PSScriptRoot
Write-Host '=== ELITE SOCCER ==='
Write-Host 'Instalando dependencias...'
npm install
if (!(Test-Path '.env')) { Copy-Item '.env.example' '.env' }
Write-Host 'Dependencias instaladas.'
Write-Host 'Configura DATABASE_URL y SESSION_SECRET en .env.'
Write-Host 'Luego: npm run build; npm run db:init; npm run db:seed; npm run dev'
