#!/bin/sh
set -eu

if git ls-files --error-unmatch .env >/dev/null 2>&1; then
  echo "ERROR: .env is tracked"
  exit 1
fi

if git grep -IEn '(oauth:)?[a-z0-9]{30,}|TWITCH_ACCESS_TOKEN=[^[:space:]]+' -- ':!package-lock.json' ':!scripts/verify-secrets.sh'; then
  echo "ERROR: possible token found in tracked files"
  exit 1
fi

echo "Secret scan passed"
