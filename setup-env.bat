@echo off
REM Thin wrapper kept for muscle memory. The real, cross-platform initializer is
REM `npm run setup` (see scripts\setup.mjs) — it copies .env.example -> .env,
REM generates a secure AUTH_SECRET, and applies branding/backend flags.
REM
REM   npm run setup
REM   npm run setup -- --name "My App" --api-url https://api.example.com --client-id Api_App
node "%~dp0scripts\setup.mjs" %*
