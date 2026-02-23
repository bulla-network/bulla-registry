# bulla-registry

Auto-generated registry of Bulla protocol contract addresses, GraphQL endpoints, and AI agent skills across all supported networks.

## For contract addresses

Use `registry.json` — it contains all contract addresses and GraphQL endpoints consolidated from source repos. Do not hardcode addresses elsewhere.

## For AI agents

See `CLAUDE.md` — it serves as the entry point for agent discovery. Skill files in `<repo>/skills/*.md` describe how to perform on-chain actions step by step.

## How it works

Each source repo (`bulla-contracts`, `bulla-contracts-v2`, `bulla-subgraph`) maintains a `bulla_registry_export/` folder with its addresses, ABIs, and skills. A GitHub Actions workflow pulls these exports and runs a consolidation script that:

1. Merges all `address_config.json` files into a single `registry.json`
2. Generates `CLAUDE.md` from the template based on what's in the repo

To regenerate locally:

```bash
npm install
npm run pull:local     # Copy from sibling workspace directories
npm run consolidate    # Generate registry.json + CLAUDE.md
```
