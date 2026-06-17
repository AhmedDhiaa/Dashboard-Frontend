#!/bin/bash
# Thin wrapper kept for muscle memory. The real, cross-platform initializer is
# `npm run setup` (see scripts/setup.mjs) — it copies .env.example → .env,
# generates a secure AUTH_SECRET, and applies branding/backend flags.
#
#   npm run setup
#   npm run setup -- --name "My App" --api-url https://api.example.com --client-id Api_App
exec node "$(dirname "$0")/scripts/setup.mjs" "$@"
