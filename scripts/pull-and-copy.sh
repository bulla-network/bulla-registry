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
LOCAL_MODE=false

if [[ "${1:-}" == "--local" ]]; then
  LOCAL_MODE=true
  WORKSPACE_ROOT="$(cd "$ROOT/.." && pwd)"
fi

# Registry folder -> public source repo and branch.
# The folder names are what consolidate.ts reads; the repo names are the real GitHub names.
declare -A SOURCE_REPOS=(
  ["bulla-contracts"]="bulla-contracts"
  ["bulla-contracts-v2"]="bulla-contracts-V2"
  ["bulla-subgraph"]="bulla-network-subgraph"
  ["factoring-contracts"]="factoring-contracts"
)
declare -A SOURCE_BRANCHES=(
  ["bulla-contracts"]="master"
  ["bulla-contracts-v2"]="main"
  ["bulla-subgraph"]="main"
  ["factoring-contracts"]="main"
)

copy_from_local() {
  local repo="$1"
  local src="$WORKSPACE_ROOT/${SOURCE_REPOS[$repo]}/bulla_registry_export"

  if [[ ! -d "$src" ]]; then
    echo "Warning: $src not found, skipping $repo"
    return
  fi

  # Stage in a temp directory first, only replace on success
  local staging
  staging=$(mktemp -d)
  cp -r "$src"/* "$staging"/

  local dest="$ROOT/$repo"
  rm -rf "$dest"
  mkdir -p "$dest"
  cp -r "$staging"/* "$dest"/
  rm -rf "$staging"

  echo "Copied $repo from local workspace"
}

copy_from_github() {
  local repo="$1"
  local source="${SOURCE_REPOS[$repo]}"
  local branch="${SOURCE_BRANCHES[$repo]}"

  local tmp
  tmp=$(mktemp -d)

  echo "Fetching $repo from $ORG/$source (branch: $branch)..."
  if ! git clone --depth 1 --branch "$branch" --filter=blob:none --sparse \
    "https://github.com/$ORG/$source.git" "$tmp/$repo" 2>/dev/null; then
    # A source that can't be fetched fails the run, so a renamed repo or branch can't go unnoticed.
    echo "::error::Failed to clone $ORG/$source (branch: $branch) for $repo"
    rm -rf "$tmp"
    FAILED+=("$repo")
    return
  fi

  cd "$tmp/$repo"
  git sparse-checkout set bulla_registry_export
  cd "$ROOT"

  if [[ -d "$tmp/$repo/bulla_registry_export" ]]; then
    # Only replace destination after confirming new data exists
    local dest="$ROOT/$repo"
    rm -rf "$dest"
    mkdir -p "$dest"
    cp -r "$tmp/$repo/bulla_registry_export"/* "$dest"/
    echo "Copied $repo from GitHub"
  else
    echo "Warning: bulla_registry_export/ not found in $repo, skipping (existing data preserved)"
  fi

  rm -rf "$tmp"
}

echo "=== Pulling bulla_registry_export from public source repos ==="
echo ""

FAILED=()
for repo in "${!SOURCE_REPOS[@]}"; do
  if $LOCAL_MODE; then
    copy_from_local "$repo"
  else
    copy_from_github "$repo"
  fi
done

echo ""
if [[ ${#FAILED[@]} -gt 0 ]]; then
  echo "=== Failed: ${FAILED[*]} (their existing data was kept) ==="
  exit 1
fi
echo "=== Done ==="
echo "Note: bulla-backend skills are maintained manually in bulla-backend/"
