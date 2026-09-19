#!/usr/bin/env bash
# Create Turso DB + token + migrate. Requires: turso auth login
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_NAME="${TURSO_DB_NAME:-kiru-hai-coach}"
GROUP_REGION="${TURSO_REGION:-aws-ap-northeast-1}"

if ! turso auth whoami >/dev/null 2>&1; then
  echo "Not logged in. Run: turso auth login"
  exit 1
fi

if ! turso db show "$DB_NAME" >/dev/null 2>&1; then
  echo "Creating DB $DB_NAME in $GROUP_REGION ..."
  turso db create "$DB_NAME" --location "$GROUP_REGION" --yes || \
    turso db create "$DB_NAME" --location "$GROUP_REGION"
fi

URL="$(turso db show "$DB_NAME" --url)"
TOKEN="$(turso db tokens create "$DB_NAME")"

echo "TURSO_DATABASE_URL=$URL"
echo "TURSO_AUTH_TOKEN=<created; not echoed again — copy from above run or recreate>"

export TURSO_DATABASE_URL="$URL"
export TURSO_AUTH_TOKEN="$TOKEN"
node "$ROOT/scripts/migrate.mjs"

# Write local env if missing keys
ENV_FILE="$ROOT/.env.local"
touch "$ENV_FILE"
grep -q '^TURSO_DATABASE_URL=' "$ENV_FILE" 2>/dev/null || echo "TURSO_DATABASE_URL=$URL" >> "$ENV_FILE"
# Always refresh token line carefully
if grep -q '^TURSO_AUTH_TOKEN=' "$ENV_FILE" 2>/dev/null; then
  sed -i.bak "s|^TURSO_AUTH_TOKEN=.*|TURSO_AUTH_TOKEN=$TOKEN|" "$ENV_FILE" && rm -f "$ENV_FILE.bak"
else
  echo "TURSO_AUTH_TOKEN=$TOKEN" >> "$ENV_FILE"
fi

echo "Wrote Turso vars to .env.local (do not commit)."
echo "Done."
