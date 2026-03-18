#!/bin/bash
# ATLAS Collaborate — Database Setup
# Run this once to apply all migrations to your Supabase project.
#
# Prerequisites:
#   1. Generate a Supabase access token at:
#      https://supabase.com/dashboard/account/tokens
#   2. Set it: export SUPABASE_ACCESS_TOKEN=your-token
#
# Usage:
#   ./scripts/setup-db.sh

set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
  echo "❌ SUPABASE_ACCESS_TOKEN not set."
  echo ""
  echo "Generate one at: https://supabase.com/dashboard/account/tokens"
  echo "Then run: export SUPABASE_ACCESS_TOKEN=your-token"
  exit 1
fi

echo "🔗 Linking to Supabase project..."
npx supabase link --project-ref vxedpmplluqcfxzucxbz

echo "🗄️  Pushing migrations..."
npx supabase db push

echo ""
echo "✅ Database setup complete!"
echo ""
echo "Next steps:"
echo "  1. Go to Supabase Dashboard → Authentication → Hooks"
echo "  2. Enable 'Customize Access Token (JWT) Hook'"
echo "  3. Set it to: public.custom_access_token_hook"
echo "  4. Go to Authentication → Providers → Google"
echo "  5. Enable Google OAuth with your GCP credentials"
echo "  6. Set redirect URL to: http://localhost:3000/callback"
