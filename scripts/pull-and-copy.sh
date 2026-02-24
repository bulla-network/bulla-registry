#!/usr/bin/env bash
set -euo pipefail

# Pull bulla_registry_export/ from each PUBLIC source repo and copy into the registry
# Usage: bash pull-and-copy.sh [--local]
#   --local: copy from local workspace siblings instead of fetching from GitHub
#
# NOTE: bulla-backend is a private repo. Its skills are maintained manually
# in the bulla-registry/bulla-backend/ directory.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

ORG="bulla-network"
BRANCH="main"
LOCAL_MODE=false

if [[ "${1:-}" == "--local" ]]; then
  LOCAL_MODE=true
  WORKSPACE_ROOT="$(cd "$ROOT/.." && pwd)"
fi

# Public source repos only (bulla-backend is private, maintained manually)
REPOS=(
  "bulla-contracts"
  "bulla-contracts-v2"
  "bulla-subgraph"
)

copy_from_local() {
  local repo="$1"
  local src="$WORKSPACE_ROOT/$repo/bulla_registry_export"

  if [[ ! -d "$src" ]]; then
    echo "Warning: $src not found, skipping $repo"
    return
  fi

  local dest="$ROOT/$repo"
  rm -rf "$dest"
  mkdir -p "$dest"

  # Copy all contents preserving structure
  cp -r "$src"/* "$dest"/
  echo "Copied $repo from local workspace"
}

copy_from_github() {
  local repo="$1"
  local dest="$ROOT/$repo"
  rm -rf "$dest"
  mkdir -p "$dest"

  local tmp
  tmp=$(mktemp -d)

  echo "Fetching $repo from GitHub..."
  if ! git clone --depth 1 --branch "$BRANCH" --filter=blob:none --sparse \
    "https://github.com/$ORG/$repo.git" "$tmp/$repo" 2>/dev/null; then
    echo "Warning: Failed to clone $repo, skipping"
    rm -rf "$tmp"
    return
  fi

  cd "$tmp/$repo"
  git sparse-checkout set bulla_registry_export
  cd "$ROOT"

  if [[ -d "$tmp/$repo/bulla_registry_export" ]]; then
    cp -r "$tmp/$repo/bulla_registry_export"/* "$dest"/
    echo "Copied $repo from GitHub"
  else
    echo "Warning: bulla_registry_export/ not found in $repo, skipping"
  fi

  rm -rf "$tmp"
}

echo "=== Pulling bulla_registry_export from public source repos ==="
echo ""

for repo in "${REPOS[@]}"; do
  if $LOCAL_MODE; then
    copy_from_local "$repo"
  else
    copy_from_github "$repo"
  fi
done

echo ""
echo "=== Done ==="
echo "Note: bulla-backend skills are maintained manually in bulla-backend/"
