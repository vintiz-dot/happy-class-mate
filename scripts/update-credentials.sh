#!/usr/bin/env bash
# =============================================================================
# Update .env and supabase/config.toml with new Supabase project credentials
# Run this after creating the happy-english-club project and getting its keys
# =============================================================================

set -e

NEW_PROJECT_REF="${1:-}"
NEW_ANON_KEY="${2:-}"

if [ -z "$NEW_PROJECT_REF" ] || [ -z "$NEW_ANON_KEY" ]; then
  echo ""
  echo "Usage: bash scripts/update-credentials.sh <NEW_PROJECT_REF> <ANON_KEY>"
  echo ""
  echo "  NEW_PROJECT_REF — short project ID (e.g. abcdefghijklmnop)"
  echo "  ANON_KEY        — anon/publishable key from Supabase dashboard"
  echo "                    (Project Settings → API → Project API keys → anon public)"
  echo ""
  echo "Example:"
  echo "  bash scripts/update-credentials.sh abcdefghijklmnop eyJhbGciOiJIUzI1NiIsIn..."
  echo ""
  exit 1
fi

NEW_URL="https://${NEW_PROJECT_REF}.supabase.co"
ENV_FILE=".env"
CONFIG_FILE="supabase/config.toml"

echo "=== Updating $ENV_FILE ==="
cat > "$ENV_FILE" <<EOF
SUPABASE_PUBLISHABLE_KEY="${NEW_ANON_KEY}"
SUPABASE_URL="${NEW_URL}"
VITE_SUPABASE_PROJECT_ID="${NEW_PROJECT_REF}"
VITE_SUPABASE_PUBLISHABLE_KEY="${NEW_ANON_KEY}"
VITE_SUPABASE_URL="${NEW_URL}"
EOF
echo "  .env updated."

echo ""
echo "=== Updating $CONFIG_FILE ==="
# Replace the project_id line
sed -i "s|^project_id = .*|project_id = \"${NEW_PROJECT_REF}\"|" "$CONFIG_FILE"
echo "  supabase/config.toml updated."

echo ""
echo "=== NEXT: Update GitHub Secrets ==="
echo "Go to: https://github.com/vintiz-dot/happy-class-mate/settings/secrets/actions"
echo ""
echo "Update these two secrets:"
echo "  VITE_SUPABASE_URL          = ${NEW_URL}"
echo "  VITE_SUPABASE_PUBLISHABLE_KEY = ${NEW_ANON_KEY}"
echo ""
echo "=== Done! Commit and push to trigger a new deployment. ==="
