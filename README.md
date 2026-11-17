# bulla-registry

Auto-generated registry of Bulla protocol contract addresses, subgraph endpoints, factoring pools, and AI agent skills across all supported networks.

## For contract addresses

Use `registry.json` — it contains all contract addresses, subgraph endpoints, factoring pools and their clients, consolidated from source repos. Do not hardcode addresses or subgraph URLs elsewhere.

`registry.schema.json` is its shape, and the contract with every consumer. Each network has one subgraph endpoint per Goldsky tag (`networks[chainId].subgraph.dev` and `.prod`). These are constant and change only when a network is added. `networks[chainId].graphql` is deprecated: it points at today's `v2-main`/`latest` tag and goes away once the subgraph serves `dev` and `prod`.

## For AI agents

See `CLAUDE.md` — it serves as the entry point for agent discovery. Skill files in `<repo>/skills/*.md` describe how to perform on-chain actions step by step.

## How it works

Each source repo (`bulla-contracts-V2`, `bulla-network-subgraph`, `factoring-contracts`) maintains a `bulla_registry_export/` folder with its addresses, ABIs, and skills. A GitHub Actions workflow, started by each source repo after a merge to main and daily as a fallback, pulls these exports and runs a consolidation script that:

1. Merges all `address_config.json` files and factoring-contracts' `pools.json` into a single `registry.json`
2. Checks it against `registry.schema.json`, plus the rules a schema can't express (`scripts/validate-registry.ts`). If the check fails, the run fails and nothing is written or committed
3. Generates `CLAUDE.md` from the template based on what's in the repo

The `validate registry` PR check runs the same consolidation, so a PR that breaks the shape fails too.

A chain ID a source exports must be listed in `NETWORKS` in `scripts/consolidate.ts`, with its name and slug (its name in the subgraph, `bulla-contracts-<slug>`, and in `pools.json`); otherwise consolidation fails.

### Changing the shape

Edit `registry.schema.json` and `scripts/consolidate.ts` together. The pool and client definitions copy factoring-contracts' `pools.schema.json` on purpose: a change there fails consolidation here until this schema is updated to match, so every change to the published shape is reviewed in this repo.

`bulla-contracts` (V1) is archived, so it is no longer pulled: its last export is committed in `bulla-contracts/` and still included in `registry.json`.

To regenerate locally:

```bash
npm install
npm run pull:local     # Copy from sibling workspace directories
npm run consolidate    # Generate registry.json + CLAUDE.md, checked against registry.schema.json
npm run validate       # Check the committed registry.json against the schema
npm test               # Tests for the checks
```
