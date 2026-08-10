# deploy.ps1 - build and deploy the cloud view to Cloudflare Pages (em-grants)
# Prereq: cloud-view\.env exists with real VITE_SUPABASE_ANON_KEY + VITE_VIEW_TOKEN
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$envFile = Get-Content .env -Raw
if ($envFile -match 'paste_anon_key_here') {
  Write-Error "Edit .env first: replace paste_anon_key_here with the anon key (Supabase dashboard -> em-grant -> Settings -> API Keys)"
}

npm run build
if ($LASTEXITCODE -ne 0) { Write-Error "build failed" }

npx wrangler pages deploy dist --project-name em-grants --branch main --commit-dirty=true
