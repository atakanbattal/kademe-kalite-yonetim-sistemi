#!/bin/bash
# manage-user Edge Function deploy
# Önce: npx supabase login
# Veya: export SUPABASE_ACCESS_TOKEN=sbp_xxx

set -e
cd "$(dirname "$0")/.."
echo "Deploying manage-user Edge Function..."
npx supabase functions deploy manage-user --project-ref rqnvoatirfczpklaamhf
echo "Deploy tamamlandı."
