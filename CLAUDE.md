# Bulla Registry

Central registry for Bulla protocol contract addresses, subgraph endpoints, factoring pools, ABIs, TypeChain types, and agent skills.

## Quick Start

- **Contract addresses, subgraph endpoints, native currencies, wrapped native tokens, USDC, factoring pools & clients**: `registry.json` (shape: `registry.schema.json`)
- **Skills** (agent instructions): `<repo>/skills/*.md`
- **ABIs**: `<repo>/abis/*.json`
- **TypeChain types**: `<repo>/typechain/*.ts`
- **npm**: `@bulla/registry` ships `registry.json` (typed), the schema, ABIs (`@bulla/registry/abis/<repo>/<Name>.json`) and client logos (`@bulla/registry/<logo>`). In code, install it rather than copying addresses

## Registry Structure

```
registry.json                    # Addresses, subgraph endpoints, factoring pools and clients (generated)
registry.schema.json             # JSON Schema registry.json is checked against

bulla-backend/                   # Backend API (private repo, manually maintained)
  skills/
    authenticate.md              # Authenticate a wallet address with the Bulla backend using Sign-In with Ethereum (SIWE).

bulla-contracts/                 # V1 contracts
  address_config.json
  abis/                          # BullaBanker, BullaClaimERC721, BullaFinance, BullaInstantPayment, BullaManager
  skills/
    batch-create-claims.md       # Create multiple on-chain payment claims in a single transaction via the BatchCreate contract.
    create-claim.md              # Create an on-chain payment claim (invoice or payment request) via the BullaBanker contract.
    instant-payment.md           # Send an instant payment to a recipient with an on-chain record.
    pay-claim.md                 # Pay an existing on-chain claim (V1).

bulla-contracts-v2/              # V2 contracts
  address_config.json
  abis/                          # BullaApprovalRegistry, BullaClaimPermitLib, BullaClaimV2, BullaFrendLendV2, BullaInvoice
  typechain/                     # TypeChain generated types
  skills/
    create-invoice.md            # Create an on-chain invoice using the BullaInvoice controller contract.
    offer-frendlend.md           # Create a peer-to-peer loan offer using the BullaFrendLendV2 controller.
    pay-invoice.md               # Pay an existing on-chain invoice.

bulla-subgraph/                  # GraphQL subgraph
  address_config.json
  skills/
    query-claim-by-id.md         # Query a specific claim by its token ID and version from the Bulla subgraph.
    query-user-claims.md         # Query all claims (invoices and payments) associated with a wallet address via the Bulla subgraph.

factoring-contracts/             # Factoring contracts
  address_config.json
  abis/                          # BullaFactoringV1, BullaFactoringV2_1, BullaFactoringV2_2, RedemptionQueue
  skills/
    deposit-to-pool.md           # Deposit USDC into a BullaFactoring pool (ERC4626 vault) to receive pool shares representing your proportional ownership of the fund.
    redeem-from-pool.md          # Redeem pool shares from a BullaFactoring pool to withdraw USDC.
```

## Networks

| Chain ID | Name | Slug | Native | Wrapped | USDC | V1 | V2 | Factoring | Pools (active / all) |
|----------|------|------|--------|---------|------|----|----|-----------|----------------------|
| 1 | Ethereum Mainnet | mainnet | ETH | WETH | USDC | yes | yes | no | 0 / 2 |
| 10 | Optimism | optimism | ETH | WETH | USDC | yes | yes | no | - |
| 50 | XDC | xdc | XDC | WXDC | USDC | yes | yes | no | 0 / 1 |
| 56 | BNB Chain | bnb_chain | BNB | WBNB | USDC | yes | yes | no | - |
| 100 | Gnosis Chain | gnosis | XDAI | WXDAI | USDC | yes | yes | no | - |
| 137 | Polygon | polygon | POL | WPOL | USDC | yes | yes | no | 0 / 2 |
| 151 | RedBelly | redbelly | RBNT | WRBNT | USDC.e | yes | no | yes | 0 / 1 |
| 8453 | Base | base | ETH | WETH | USDC | yes | yes | yes | 0 / 2 |
| 42161 | Arbitrum | arbitrum | ETH | WETH | USDC | yes | yes | yes | 2 / 5 |
| 42220 | Celo | celo | CELO | - | - | yes | yes | no | - |
| 43114 | Avalanche | avalanche | AVAX | WAVAX | USDC | yes | yes | no | - |
| 11155111 | Sepolia | sepolia | ETH | WETH | USDC | yes | yes | yes | 0 / 13 |

## How to Use

### Look up a contract address

```json
// registry.json → networks[chainId].contracts[repo][contractName]
// Example: BullaInvoice on Mainnet
registry.networks["1"].contracts["bulla-contracts-v2"].bullaInvoice
// → "0xfe2631bcb3e622750b6fbb605a416173ffa3a770"
```

### Look up a subgraph endpoint

```json
// registry.json → networks[chainId].subgraph[tag], one endpoint per Goldsky tag (dev, prod)
registry.networks["8453"].subgraph.prod
// → "https://api.goldsky.com/.../bulla-contracts-base/prod/gn"
```

The endpoints are constant: they change only when a network is added. Use `dev` in development and `prod` in
production. Don't use the older `v2-main`/`latest` tags: they serve an outdated build.

### Look up a network's native currency, wrapped native token or USDC

```json
// registry.json → networks[chainId].nativeCurrency, .wrappedNativeToken and .usdc
registry.networks["137"].nativeCurrency
// → { "symbol": "POL", "decimals": 18 }
registry.networks["137"].wrappedNativeToken
// → { "address": "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", "symbol": "WPOL", "decimals": 18 }
registry.networks["56"].usdc
// → { "address": "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", "symbol": "USDC", "decimals": 18 }
```

`wrappedNativeToken` and `usdc` are `null` where there is none (Celo has neither). `usdc` is the USDC Bulla uses
on the network, native or bridged: its `symbol` says which (`USDC.e` on RedBelly). Don't assume 6 decimals: BNB
Chain's USDC has 18. The native currency has no contract; Bulla uses the zero address for it.

### Look up a factoring pool or client

```json
// registry.json → pools[] (every pool on every chain, archived ones included) and clients[clientKey]
registry.pools.filter(p => p.chainId === 42161 && p.category === "active")
registry.clients["tcs"]
// → { "displayName": "TCS", "website": "...", "logo": "factoring-contracts/logos/tcs.png" }
```

A relative `logo` is a path from the registry root, and from the npm package root.

### Perform an action

Read the relevant skill file in `<repo>/skills/`. Each skill documents:

- Function signatures and struct definitions
- Step-by-step instructions
- Concrete examples
- Common errors

## Updating

This registry is updated by the Consolidate Registry workflow (started by each source repo after a merge to main, and daily as a fallback), which pulls each source repo's export and commits as the bulla-registry-sync GitHub App. To run it now, start the workflow from the Actions tab. To update manually:

```bash
npm install
npm run pull           # Fetch from GitHub (or npm run pull:local for local workspaces)
npm run consolidate    # Generate registry.json + CLAUDE.md, checked against registry.schema.json
```

When what the package ships changed since the last release, the same workflow publishes a new `@bulla/registry` version to npm. The README lists the version rules.

## Source Repos

| Repo | What it provides |
|------|------------------|
| [bulla-contracts](https://github.com/bulla-network/bulla-contracts) | V1 contract addresses, ABIs, skills |
| [bulla-contracts-v2](https://github.com/bulla-network/bulla-contracts-v2) | V2 contract addresses, ABIs, TypeChain, skills |
| [bulla-subgraph](https://github.com/bulla-network/bulla-network-subgraph) | GraphQL endpoints, query skills |
| [factoring-contracts](https://github.com/bulla-network/factoring-contracts) | Factoring contract addresses, pools and clients (`pools.json`), client logos, ABIs, skills |
| bulla-backend (private) | Authentication skill (manually maintained) |

Each source repo exports data in a `bulla_registry_export/` directory. The CI pipeline pulls these exports and consolidates them into `registry.json`.
