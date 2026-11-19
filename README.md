# bulla-registry

Auto-generated registry of Bulla protocol contract addresses, subgraph endpoints, factoring pools, and AI agent skills across all supported networks.

## For contract addresses

Use `registry.json` — it contains all contract addresses, subgraph endpoints, factoring pools and their clients, consolidated from source repos. Do not hardcode addresses or subgraph URLs elsewhere.

`registry.schema.json` is its shape, and the contract with every consumer. Each network has one subgraph endpoint per Goldsky tag (`networks[chainId].subgraph.dev` and `.prod`). These are constant and change only when a network is added. Use `dev` in development and `prod` in production. There is no single `graphql` endpoint: the old `v2-main`/`latest` tags serve an outdated build.

## npm package

`@bulla/registry` ships `registry.json`, `registry.schema.json`, the ABIs and the client logos, with TypeScript types generated from the schema. It is MIT-licensed (`LICENSE`), except the client logos: they belong to their owners, are included only to identify their pools, and are not covered by the license.

```bash
npm install @bulla/registry
```

```ts
import { registry, type Pool, type Address } from "@bulla/registry"; // or require("@bulla/registry")

const invoice: Address | undefined = registry.networks["1"]?.contracts["bulla-contracts-v2"]?.bullaInvoice;
const active: Pool[] = registry.pools.filter((p) => p.chainId === 42161 && p.category === "active");
```

Addresses are typed `` `0x${string}` ``, viem's `Address`.

The JSON files are importable too: `@bulla/registry/registry.json`, `@bulla/registry/registry.schema.json`, and each ABI as `@bulla/registry/abis/<repo>/<Name>.json`, e.g. `@bulla/registry/abis/bulla-contracts-v2/BullaInvoice.json`. An ABI file is the bare `abi` array: the bytecode and metadata in this repo's V1 and V2 artifacts are compiled BUSL-1.1 code and are not published.

A client's `logo` is an https URL or a path from the package root: `factoring-contracts/logos/tcs.png` is `@bulla/registry/factoring-contracts/logos/tcs.png`. A bundler needs every logo in the bundle to resolve a path at runtime, e.g. a glob import of `@bulla/registry/factoring-contracts/logos/*`.

### Versions

The Consolidate Registry workflow releases a new version when what the package ships changed since the last release (the highest `v*` tag). A run that changes nothing publishes nothing. `scripts/release-version.ts` picks the bump:

| Change | Bump |
|--------|------|
| A removed or renamed field, a field that is no longer required, or a removed enum value (`registry.schema.json`) | **major** |
| A removed network, contract, pool, client, ABI, ABI function/event/error, or logo | **major** |
| A new field or enum value, or a new network, contract, pool, client, ABI, ABI function/event/error, or logo | **minor** |
| A changed address, endpoint or other value; any other change (e.g. a description, an ABI parameter name, a redrawn logo) | **patch** |

A rename is a removal plus an addition, so it is major. `generatedAt` is ignored, and so are ABI bytecode and metadata, which the package does not ship.

The workflow sets the version in `package.json`, commits it as bulla-registry-sync, publishes with npm trusted publishing (OIDC, no token), then tags the release (`v1.2.3`) with a GitHub release listing the changes. A change merged by hand (e.g. a schema change) is released by the next run, daily at the latest. To force a bigger bump, set a higher version in `package.json` in the PR. npm can take a few minutes after a publish to list the new version.

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
npm test               # Tests for the checks, the version rules and the packed package
npm run build          # Build dist/ (the package's JS and types); npm pack runs it
npm run release:version  # Pick the next version from the changes since the last release tag
```
