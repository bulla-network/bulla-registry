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
  abis/                          # BullaFactoringV1, BullaFactoringV2_1, RedemptionQueue
  skills/
    deposit-to-pool.md           # Deposit USDC into a BullaFactoring pool (ERC4626 vault) to receive pool shares representing your proportional ownership of the fund.
    redeem-from-pool.md          # Redeem pool shares from a BullaFactoring pool to withdraw USDC.
```

## Networks

| Chain ID | Name | V1 | V2 | Factoring | Subgraph |
|----------|------|----|----|-----------|----------|
| 1 | Ethereum Mainnet | yes | yes | no | yes |
| 10 | Optimism | yes | yes | no | yes |
| 56 | BNB Chain | yes | yes | no | yes |
| 100 | Gnosis Chain | yes | yes | no | yes |
| 137 | Polygon | yes | yes | no | yes |
| 151 | RedBelly | yes | no | yes | yes |
| 8453 | Base | yes | yes | yes | yes |
| 42161 | Arbitrum | yes | yes | no | yes |
| 42220 | Celo | yes | yes | no | yes |
| 43114 | Avalanche | yes | yes | no | yes |
| 11155111 | Sepolia | yes | yes | yes | yes |

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
| [factoring-contracts](https://github.com/bulla-network/factoring-contracts) | Factoring contract addresses, ABIs, skills |
| bulla-backend (private) | Authentication skill (manually maintained) |

Each source repo exports data in a `bulla_registry_export/` directory. The CI pipeline pulls these exports and consolidates them into `registry.json`.
