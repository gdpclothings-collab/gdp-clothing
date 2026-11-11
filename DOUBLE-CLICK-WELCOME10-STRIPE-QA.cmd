@echo off
setlocal
cd /d "%~dp0"
echo ========================================================
echo GDP CLOTHING WELCOME10 - STRIPE TEST SANDBOX QA
echo ========================================================
echo This run uses test-only Stripe CLI events and localhost.
echo It does NOT process live charges or touch production data.
echo Do not share any Stripe pairing codes or credentials.
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo BLOCKED: Node.js 22 or newer must be installed.
  echo Install via https://nodejs.org/
  goto end
)
where stripe >nul 2>nul
if errorlevel 1 (
  echo BLOCKED: Stripe CLI is not installed.
  echo Install from https://docs.stripe.com/stripe-cli
  echo Windows PowerShell: winget install Stripe.StripeCLI
  goto end
)
echo Checking Stripe CLI authentication with read-only account request...
stripe get /v1/account >nul 2>nul
if errorlevel 1 (
  echo Stripe CLI login is required. Your browser will open for account approval.
  echo Select GDP Clothing. Never provide pairing codes in chat.
  stripe login
  if errorlevel 1 (
    echo BLOCKED: Stripe CLI login not completed.
    goto end
  )
)
echo Running local signed test-mode delivery...
node scripts\qa\welcome10-stripe-cli-run.mjs --run
if errorlevel 1 (
  echo QA BLOCKED or PARTIAL: read RESULTS\WELCOME10-STRIPE-SANDBOX-QA-REPORT.txt
) else (
  echo Sandbox transport tests completed. Actual Edge/database integration still BLOCKED.
)
:end
echo.
echo Upload only RESULTS\WELCOME10-STRIPE-SANDBOX-QA-REPORT.txt for review.
echo Never share keys, OTP codes, tokens or Stripe CLI pairing codes.
pause
endlocal
