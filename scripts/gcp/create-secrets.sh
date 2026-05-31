#!/usr/bin/env bash
set -euo pipefail

: "${PROJECT_ID:?Set PROJECT_ID before running this script.}"

create_secret_if_missing() {
  local secret_name="$1"

  if ! gcloud secrets describe "$secret_name" --project "$PROJECT_ID" >/dev/null 2>&1; then
    gcloud secrets create "$secret_name" --project "$PROJECT_ID" --replication-policy automatic
  fi
}

create_secret_if_missing "scanhemat-database-url"
create_secret_if_missing "scanhemat-nextauth-secret"
create_secret_if_missing "scanhemat-gemini-api-key"

echo "Secrets created if missing. Add secret versions with gcloud secrets versions add."
