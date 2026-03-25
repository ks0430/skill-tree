#!/bin/bash
# apply-realtime-migration.sh
# Applies migration 005 to enable Supabase Realtime for skill_nodes.
#
# Usage:
#   DATABASE_URL="postgresql://postgres:[password]@db.cnanilxkafouncbigbnn.supabase.co:5432/postgres" bash scripts/apply-realtime-migration.sh
#
# OR: Copy-paste the SQL from supabase/migrations/005_enable_realtime.sql
# into the Supabase Dashboard → Database → SQL Editor

set -e

if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL not set."
  echo ""
  echo "Get it from: https://supabase.com/dashboard/project/cnanilxkafouncbigbnn/settings/database"
  echo ""
  echo "Then run:"
  echo "  DATABASE_URL='postgresql://...' bash scripts/apply-realtime-migration.sh"
  echo ""
  echo "OR manually apply via Supabase Dashboard SQL Editor:"
  echo "  https://supabase.com/dashboard/project/cnanilxkafouncbigbnn/editor"
  cat supabase/migrations/005_enable_realtime.sql
  exit 1
fi

echo "Applying migration 005_enable_realtime.sql..."
psql "$DATABASE_URL" -f supabase/migrations/005_enable_realtime.sql
echo "✅ Done. skill_nodes is now in the supabase_realtime publication."
echo "   Realtime UPDATE events will now fire when tickets are marked complete."
