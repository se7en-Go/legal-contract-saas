#!/usr/bin/env bash

set -euo pipefail

PGHOST=aws-1-ap-southeast-1.pooler.supabase.com
PGPORT=5432
PGUSER=postgres.crndpzhpvhcncoscoiba
PGPASSWORD=sYrrAY6OYCLKuUyI
PGDATABASE=postgres
PGSSLMODE=require

# Split statements by semicolon + newline to avoid overwhelming pooler
awk 'BEGIN{RS=";\n"; ORS=";\n"} {print}' supabase/migrations/20251119_init_schema.sql |
  while IFS= read -r stmt; do
    trimmed=$(echo "$stmt" | sed 's/^\s*//;s/\s*$//')
    if [ -z "$trimmed" ]; then
      continue
    fi
    echo "Running statement: ${trimmed:0:60}..."
    echo "$trimmed;" | psql --set ON_ERROR_STOP=1 --quiet
  done

echo "Migration applied"
