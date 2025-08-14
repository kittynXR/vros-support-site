@echo off
REM VROS API Cloudflare Worker Setup Script (Windows)
REM This script helps set up the Cloudflare Worker for the VROS Bug Tracker

echo ===================================
echo VROS API Cloudflare Worker Setup
echo ===================================
echo.

REM Check if wrangler is installed
where wrangler >nul 2>nul
if %errorlevel% neq 0 (
    echo X Wrangler CLI not found. Installing...
    npm install -g wrangler
) else (
    echo ✓ Wrangler CLI found
)

echo.
echo Step 1: Login to Cloudflare
echo ----------------------------
wrangler login

echo.
echo Step 2: Creating KV Namespaces
echo -------------------------------
echo Creating TOKENS namespace...
wrangler kv:namespace create "TOKENS"
echo.
echo Creating CACHE namespace...
wrangler kv:namespace create "CACHE"
echo.
echo Creating RATE_LIMIT namespace...
wrangler kv:namespace create "RATE_LIMIT"

echo.
echo IMPORTANT: Copy the namespace IDs above and update wrangler.toml
pause

echo.
echo Step 3: Setting up Secrets
echo ---------------------------
echo You'll need:
echo 1. A GitHub Personal Access Token with 'repo' scope
echo    Create one at: https://github.com/settings/tokens
echo 2. An admin key for protected endpoints (generate a random string)
echo.

echo Setting GITHUB_TOKEN...
wrangler secret put GITHUB_TOKEN

echo.
echo Setting ADMIN_KEY...
wrangler secret put ADMIN_KEY

echo.
echo Step 4: Deploy Worker
echo ---------------------
echo Deploying to Cloudflare...
wrangler deploy

echo.
echo Step 5: Test the API
echo --------------------
echo Testing health endpoint...
echo (Manual test required - check the URL above with /api/health)

echo.
echo.
echo ===================================
echo ✓ Setup Complete!
echo ===================================
echo.
echo Next steps:
echo 1. Configure custom domain in Cloudflare dashboard (optional)
echo 2. Update your frontend to use the API URL
echo 3. Test bug submission from the support site
echo.
echo Useful commands:
echo   wrangler dev          - Run locally for development
echo   wrangler tail         - View real-time logs
echo   wrangler deploy       - Deploy updates
echo.
pause