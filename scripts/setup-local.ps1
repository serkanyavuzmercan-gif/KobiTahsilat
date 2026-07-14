# KobiTahsilat yerel kurulum (Windows PowerShell)
# Kullanım: proje klasöründe  .\scripts\setup-local.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "Node sürümü:" -ForegroundColor Cyan
node -v
if ($LASTEXITCODE -ne 0) {
  Write-Host "HATA: Node.js yüklü değil. https://nodejs.org adresinden LTS (20+) kurun." -ForegroundColor Red
  exit 1
}

$major = [int]((node -v) -replace 'v(\d+)\..*','$1')
if ($major -lt 20) {
  Write-Host "UYARI: Node 20+ önerilir (şu an: $(node -v))" -ForegroundColor Yellow
}

Write-Host "`nnpm install..." -ForegroundColor Cyan
npm install
if ($LASTEXITCODE -ne 0) { exit 1 }

if (-not (Test-Path ".env.local")) {
  Copy-Item "env.example" ".env.local"
  Write-Host "`n.env.local oluşturuldu. Supabase anahtarlarını doldurun." -ForegroundColor Yellow
} else {
  Write-Host "`.env.local` zaten var." -ForegroundColor Green
}

Write-Host "`nKurulum tamam. Çalıştırmak için:" -ForegroundColor Green
Write-Host "  npm run dev" -ForegroundColor White
Write-Host "  Tarayıcı: http://localhost:3000" -ForegroundColor White
