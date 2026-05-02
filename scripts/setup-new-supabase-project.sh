#!/usr/bin/env bash
# =============================================================================
# Setup script: Link to new Supabase project and push all 140 migrations
# New project: happy-english-club
# Org: ytgadwypaxoyolmvdpnj
#
# Prerequisites:
#   1. Supabase CLI installed  (see INSTALL section below)
#   2. Run: supabase login
#   3. New project already created in the Supabase dashboard
#   4. Have the new project REF ready (e.g. abcdefghijklmnop)
#
# INSTALL Supabase CLI on Windows:
#   Option A (Scoop):  scoop bucket add supabase https://github.com/supabase/scoop-bucket.git && scoop install supabase
#   Option B (npm):    npm install -g supabase
#   Option C (direct): https://github.com/supabase/cli/releases  → download supabase_windows_amd64.tar.gz
# =============================================================================

set -e

NEW_PROJECT_REF="${1:-}"
NEW_DB_PASSWORD="${2:-}"

if [ -z "$NEW_PROJECT_REF" ]; then
  echo ""
  echo "Usage: bash scripts/setup-new-supabase-project.sh <NEW_PROJECT_REF> <DB_PASSWORD>"
  echo ""
  echo "  NEW_PROJECT_REF  — the short ID shown in your Supabase project URL"
  echo "                     e.g. for https://abcdef.supabase.co  →  abcdef"
  echo "  DB_PASSWORD      — the database password you set when creating the project"
  echo ""
  echo "Example:"
  echo "  bash scripts/setup-new-supabase-project.sh abcdefghijklmnop MySecurePass123"
  echo ""
  exit 1
fi

echo ""
echo "=== Step 1: Logging in to Supabase CLI ==="
supabase login

echo ""
echo "=== Step 2: Linking to project $NEW_PROJECT_REF ==="
supabase link --project-ref "$NEW_PROJECT_REF" --password "$NEW_DB_PASSWORD"

echo ""
echo "=== Step 3: Pushing all 140 migrations ==="
supabase db push

echo ""
echo "=== Step 4: Fetching new project credentials ==="
echo "Run the following to get your anon key and URL:"
echo ""
echo "  supabase projects api-keys --project-ref $NEW_PROJECT_REF"
echo ""
echo "Then update your .env and GitHub Secrets with:"
echo "  VITE_SUPABASE_URL=https://$NEW_PROJECT_REF.supabase.co"
echo "  VITE_SUPABASE_PUBLISHABLE_KEY=<anon key from above>"
echo ""
echo "=== Done! Run scripts/update-credentials.sh to update .env automatically. ==="
