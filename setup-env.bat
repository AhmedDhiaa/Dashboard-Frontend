@echo off
REM ============================================================================
REM Acme Analytics - Quick Environment Setup (Windows)
REM ============================================================================

echo.
echo 🚀 Setting up Acme Analytics environment...
echo.

REM Check if .env.local exists
if exist ".env.local" (
    echo ⚠️  .env.local already exists!
    set /p OVERWRITE="Do you want to overwrite it? (y/n): "
    if /i not "%OVERWRITE%"=="y" (
        echo ❌ Setup cancelled.
        exit /b 1
    )
)

REM Create .env.local
(
echo # ============================================================================
echo # MAMNON ANALYTICS - ENVIRONMENT CONFIGURATION
echo # ============================================================================
echo.
echo # API Configuration
echo NEXT_PUBLIC_API_URL=https://api-dev.example.com
echo NEXT_PUBLIC_SOCKET_URL=https://api-dev.example.com
echo.
echo # Google Maps API Key ^(REQUIRED!^)
echo # Get your key from: https://console.cloud.google.com/apis/credentials
echo NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY_HERE
echo.
echo # Authentication
echo AUTH_SECRET=change-me-to-a-random-secret-string
echo NEXTAUTH_URL=http://localhost:3000
echo.
echo # Environment
echo NODE_ENV=development
) > .env.local

echo ✅ .env.local file created!
echo.
echo ⚠️  IMPORTANT: Update the following in .env.local:
echo    1. NEXT_PUBLIC_GOOGLE_MAPS_API_KEY - Add your Google Maps API key
echo    2. AUTH_SECRET - Generate a random secret
echo.
echo 📚 For detailed setup instructions, see: GOOGLE_MAPS_SETUP.md
echo.
echo 🚀 After updating, restart your dev server:
echo    pnpm dev
echo.
pause

