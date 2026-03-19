#!/bin/sh
# Deploy to Cloudflare Workers with runtime vars from build env
# Build env vars are set in Cloudflare Dashboard > Build > Variables and Secrets

# Deploy the worker
npx wrangler deploy

# Set runtime vars from build env (these persist until next deploy)
if [ -n "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "$SUPABASE_SERVICE_ROLE_KEY" | npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
fi
if [ -n "$ANTHROPIC_API_KEY" ]; then
  echo "$ANTHROPIC_API_KEY" | npx wrangler secret put ANTHROPIC_API_KEY
fi
if [ -n "$NEXT_PUBLIC_SUPABASE_URL" ]; then
  echo "$NEXT_PUBLIC_SUPABASE_URL" | npx wrangler secret put NEXT_PUBLIC_SUPABASE_URL
fi
if [ -n "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]; then
  echo "$NEXT_PUBLIC_SUPABASE_ANON_KEY" | npx wrangler secret put NEXT_PUBLIC_SUPABASE_ANON_KEY
fi
if [ -n "$NEXT_PUBLIC_GOOGLE_PLACES_API_KEY" ]; then
  echo "$NEXT_PUBLIC_GOOGLE_PLACES_API_KEY" | npx wrangler secret put NEXT_PUBLIC_GOOGLE_PLACES_API_KEY
fi
