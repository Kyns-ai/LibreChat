#!/usr/bin/env bash
# Deploy SearXNG as a Railway service and wire it to LibreChat.
# Usage: ./config/railway-add-searxng.sh
# Requires: Railway CLI logged in and project linked.

set -euo pipefail
cd "$(dirname "$0")/.."

SEARXNG_SECRET_KEY=$(openssl rand -hex 32)
echo "🔑 Generated secret key: ${SEARXNG_SECRET_KEY:0:8}..."

echo ""
echo "📦 Creating SearXNG service on Railway..."
echo "   This deploys ./searxng/Dockerfile as a private service."
echo ""

# Create the SearXNG service from the local searxng/ directory
railway service create searxng 2>/dev/null || echo "   (service may already exist)"

# Set environment variables on the SearXNG service
railway variables set \
  --service searxng \
  "SEARXNG_SECRET_KEY=${SEARXNG_SECRET_KEY}" \
  "PORT=8080"

echo ""
echo "🚀 Deploying SearXNG service..."
railway up \
  --service searxng \
  --context ./searxng \
  --detach

echo ""
echo "⏳ Waiting for SearXNG to be reachable..."
sleep 15

# Get the internal Railway URL for SearXNG
SEARXNG_INTERNAL_URL=$(railway domain --service searxng 2>/dev/null || echo "")

if [ -z "${SEARXNG_INTERNAL_URL}" ]; then
  echo ""
  echo "⚠️  Could not auto-detect SearXNG URL."
  echo "   Open your Railway dashboard → searxng service → Settings → Networking"
  echo "   Copy the private/internal domain and run:"
  echo "   railway variables set --service LibreChat SEARXNG_INSTANCE_URL=https://<private-domain>"
  echo ""
else
  SEARXNG_URL="https://${SEARXNG_INTERNAL_URL}"
  echo "✅ SearXNG URL: ${SEARXNG_URL}"

  echo ""
  echo "🔗 Setting SEARXNG_INSTANCE_URL on LibreChat service..."
  railway variables set \
    --service LibreChat \
    "SEARXNG_INSTANCE_URL=${SEARXNG_URL}"

  echo ""
  echo "🔄 Redeploying LibreChat to pick up the new variable..."
  railway redeploy --service LibreChat --yes 2>/dev/null || true
fi

echo ""
echo "✅ Done!"
echo ""
echo "To verify, open LibreChat → any chat → click the 🔍 web search badge."
echo "If you see search results, the integration is working."
