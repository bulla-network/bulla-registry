# Bulla Registry

Central registry for Bulla protocol contract addresses, GraphQL endpoints, ABIs, TypeChain types, and agent skills.

## Quick Start

- **Contract addresses & GraphQL endpoints**: `registry.json`
- **Skills** (agent instructions): `<repo>/skills/*.md`
- **ABIs**: `<repo>/abis/*.json`
- **TypeChain types**: `<repo>/typechain/*.ts`

## Registry Structure

```
registry.json                    # All addresses + GraphQL endpoints (generated)

bulla-backend/                   # Backend API (private repo, manually maintained)
  skills/
    authenticate.md              # Authenticate a wallet address with the Bulla backend using Sign-In with Ethereum (SIWE).
```

## Networks

| Chain ID | Name | V1 | V2 | Subgraph |
|----------|------|----|----|----------|
| 1 | Ethereum Mainnet | no | no | no |
| 10 | Optimism | no | no | no |
| 56 | BNB Chain | no | no | no |
| 100 | Gnosis Chain | no | no | no |
| 137 | Polygon | no | no | no |
| 151 | RedBelly | no | no | no |
| 8453 | Base | no | no | no |
| 42161 | Arbitrum | no | no | no |
| 42220 | Celo | no | no | no |
| 43114 | Avalanche | no | no | no |
| 11155111 | Sepolia | no | no | no |

## How to Use

### Look up a contract address

```json
// registry.json → networks[chainId].contracts[repo][contractName]
// Example: BullaInvoice on Mainnet
registry.networks["1"].contracts["bulla-contracts-v2"].bullaInvoice
// → "0xfe2631bcb3e622750b6fbb605a416173ffa3a770"
```

### Look up a GraphQL endpoint

```json
// registry.json → networks[chainId].graphql
registry.networks["8453"].graphql
// → "https://api.goldsky.com/.../bulla-contracts-base/v2-main/gn"
```

### Perform an action

Read the relevant skill file in `<repo>/skills/`. Each skill documents:

- Function signatures and struct definitions
- Step-by-step instructions
- Concrete examples
- Common errors

## Updating

This registry is updated via GitHub Actions when source repos push changes. To update manually:

```bash
npm install
npm run pull           # Fetch from GitHub (or npm run pull:local for local workspaces)
npm run consolidate    # Generate registry.json + CLAUDE.md
```

## Source Repos

| Repo | What it provides |
|------|------------------|
| [bulla-contracts](https://github.com/bulla-network/bulla-contracts) | V1 contract addresses, ABIs, skills |
| [bulla-contracts-v2](https://github.com/bulla-network/bulla-contracts-v2) | V2 contract addresses, ABIs, TypeChain, skills |
| [bulla-subgraph](https://github.com/bulla-network/bulla-subgraph) | GraphQL endpoints, query skills |
| bulla-backend (private) | Authentication skill (manually maintained) |

Each source repo exports data in a `bulla_registry_export/` directory. The CI pipeline pulls these exports and consolidates them into `registry.json`.
