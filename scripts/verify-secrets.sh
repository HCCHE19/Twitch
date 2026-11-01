#!/bin/sh
set -eu

pattern='(oauth:)?[a-z0-9]{30,}|TWITCH_ACCESS_TOKEN=[^[:space:]]+'

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if git ls-files --error-unmatch .env >/dev/null 2>&1; then
    echo "ERROR: .env is tracked"
    exit 1
  fi
  if git grep -IEn "$pattern" -- ':!package-lock.json' ':!scripts/verify-secrets.sh'; then
    echo "ERROR: possible token found in tracked files"
    exit 1
  fi
else
  if grep -RIE "$pattern" . --exclude=package-lock.json --exclude=verify-secrets.sh --exclude-dir=node_modules --exclude-dir=dist; then
    echo "ERROR: possible token found in project files"
    exit 1
  fi
fi

echo "Secret scan passed"
