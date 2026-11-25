#!/usr/bin/env bash
# One-command deploy to Vercel.
#   Usage:  bash deploy-vercel.sh
# First run opens your browser once to log in to Vercel (free account is fine).
# It copies the settings from .env.local into Vercel, then deploys to production.
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f .env.local ]; then
  echo "❌ .env.local not found. Copy .env.example to .env.local and fill it in first."; exit 1
fi

VERCEL="npx --yes vercel@latest"

echo "▶ 1/4  Logging in to Vercel (a browser window may open)…"
$VERCEL whoami >/dev/null 2>&1 || $VERCEL login

echo "▶ 2/4  Linking this folder to a Vercel project…"
$VERCEL link --yes >/dev/null

# Read a value from .env.local (ignores comments, strips quotes / CR)
get() { grep -E "^$1=" .env.local | tail -1 | cut -d= -f2- | tr -d '\r' | sed -E 's/^"(.*)"$/\1/'; }

echo "▶ 3/4  Uploading settings from .env.local…"
VARS=(AI_PROVIDER OPENAI_BASE_URL OPENAI_API_KEY OPENAI_MODEL
      ANTHROPIC_API_KEY ANTHROPIC_MODEL ANTHROPIC_EFFORT
      ADMIN_PASSWORD NEXT_PUBLIC_COACH_NAME NEXT_PUBLIC_BRAND_NAME)
for name in "${VARS[@]}"; do
  value="$(get "$name" || true)"
  # skip empty values and placeholders
  if [ -z "$value" ] || [[ "$value" == *xxxx* ]] || [[ "$value" == PASTE_* ]]; then continue; fi
  # only upload the keys for the provider actually in use
  provider="$(get AI_PROVIDER || true)"
  if [[ "$name" == ANTHROPIC_* && "$provider" == "openai" ]]; then continue; fi
  if [[ "$name" == OPENAI_* && "$provider" != "openai" ]]; then continue; fi
  $VERCEL env rm "$name" production --yes >/dev/null 2>&1 || true
  printf '%s' "$value" | $VERCEL env add "$name" production >/dev/null
  echo "   ✓ $name"
done

echo "▶ 4/4  Building & deploying (takes ~1–2 minutes)…"
$VERCEL deploy --prod --yes

echo ""
echo "✅ Done! The 'Production' URL above is your live chatbot — share that link with the client."
