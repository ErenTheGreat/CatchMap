#!/usr/bin/env bash
# Redeploy Pro-related Supabase edge functions from repo source.
# Requires: supabase CLI logged in (supabase login) and project linked.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v supabase >/dev/null 2>&1; then
  echo "Install Supabase CLI: https://supabase.com/docs/guides/cli"
  exit 1
fi

PROJECT_REF="${SUPABASE_PROJECT_REF:-cpzwvlpqdzjjsdlnmfgg}"

echo "==> Deploying ai-proxy and revenuecat-webhook to $PROJECT_REF"
supabase functions deploy ai-proxy --project-ref "$PROJECT_REF"
supabase functions deploy revenuecat-webhook --project-ref "$PROJECT_REF" --no-verify-jwt

echo ""
echo "Deployed. Set secrets in Supabase Dashboard if not already:"
echo "  GEMINI_API_KEY"
echo "  REVENUECAT_SECRET_API_KEY"
echo "  REVENUECAT_WEBHOOK_SECRET (optional)"
