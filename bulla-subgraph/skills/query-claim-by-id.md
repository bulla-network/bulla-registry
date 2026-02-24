# Query Claim by ID

## Description
Query a specific claim by its token ID and version from the Bulla subgraph. Returns full claim details including status, amounts, and event history.

## Context
- **Repo**: bulla-subgraph
- **Endpoint**: Use the GraphQL endpoint from the registry for the target chainId
- **Networks**: all (chainIds: 1, 10, 56, 100, 137, 151, 8453, 42161, 42220, 43114, 11155111)

## Prerequisites
- The claim's token ID and version (v1 or v2)
- The target chain's GraphQL endpoint URL from the registry

## GraphQL Query
```graphql
query GetClaimById($claimId: ID!) {
  claim(id: $claimId) {
    id
    version
    tokenId
    claimType
    status
    binding
    description
    amount
    paidAmount
    dueBy
    created
    isTransferred
    ipfsHash
    tokenURI
    transactionHash
    bullaClaimAddress
    creditor {
      id
      address
    }
    debtor {
      id
      address
    }
    creator {
      id
      address
    }
    token {
      address
      symbol
      decimals
      isNative
    }
    controller {
      address
    }
    lastUpdatedBlockNumber
    lastUpdatedTimestamp
    logs(orderBy: timestamp, orderDirection: asc) {
      ... on ClaimCreatedEvent {
        eventName
        timestamp
        transactionHash
      }
      ... on ClaimPaymentEvent {
        eventName
        timestamp
        paymentAmount
        paidBy
        transactionHash
      }
      ... on ClaimRejectedEvent {
        eventName
        timestamp
        from
        note
        transactionHash
      }
      ... on ClaimRescindedEvent {
        eventName
        timestamp
        from
        note
        transactionHash
      }
    }
  }
}
```

### Variables
| Name | Type | Description |
|------|------|-------------|
| `claimId` | `ID!` | Format: `tokenid-version` in **lowercase** (e.g., `"42-v1"` or `"15-v2"`) |

### Key Response Fields
| Field | Type | Description |
|-------|------|-------------|
| `status` | `ClaimStatus` | `Pending`, `Paid`, `Rejected`, `Rescinded`, `Repaying`, or `Impaired` |
| `amount` | `BigInt` | Total claim amount in token's smallest unit |
| `paidAmount` | `BigInt` | Amount paid so far |
| `dueBy` | `BigInt` | Unix timestamp for due date |
| `logs` | `[IClaimEvent]` | Chronological list of all events on this claim |
| `controller.address` | `Bytes` | The contract that controls the claim (BullaBanker for v1, BullaInvoice/FrendLend for v2) |
| `bullaClaimAddress` | `Bytes` | The BullaClaimERC721 (v1) or BullaClaimV2 (v2) contract address |

## Steps
1. Look up the GraphQL endpoint URL for the target chainId from the registry
2. Construct the claim ID as `"{tokenId}-{version}"` in **lowercase** (e.g., `"42-v1"` or `"15-v2"`)
3. Send a POST request to the endpoint with the query and variables
4. Parse the `claim` object from the response

## Example
```bash
# Query v2 claim with token ID 15
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"query": "query GetClaimById($claimId: ID!) { claim(id: $claimId) { id version tokenId claimType status amount paidAmount dueBy token { symbol decimals } creditor { address } debtor { address } logs { ... on ClaimPaymentEvent { eventName paymentAmount timestamp } } } }", "variables": {"claimId": "15-v2"}}' \
  https://api.goldsky.com/api/public/project_clxvwihx9eci401ud1suddgpf/subgraphs/bulla-contracts-mainnet/v2-main/gn
```

## Common Errors
- Claim not found: Returns `null` for `claim` — wrong token ID, wrong version, or wrong chain
- Wrong ID format: Must be `"tokenid-version"` in **lowercase** (e.g., `"42-v2"`, not `"42-V2"` or `"42"`)
- Wrong chain: Claims are chain-specific; query the correct chain's endpoint
