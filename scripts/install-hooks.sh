#!/usr/bin/env bash
# Installs the tracked git hooks from scripts/hooks/ into .git/hooks/.
# Run after a fresh clone, or whenever scripts/hooks/* changes.

set -e

cd "$(git rev-parse --show-toplevel)"

if [ ! -d scripts/hooks ]; then
  echo "❌ scripts/hooks/ not found"
  exit 1
fi

for hook in scripts/hooks/*; do
  name=$(basename "$hook")
  cp "$hook" ".git/hooks/$name"
  chmod +x ".git/hooks/$name"
  echo "✅ installed $name"
done

echo "Done. Existing hooks were overwritten."
