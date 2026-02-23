# Query User Claims

## Description
Query all claims (invoices and payments) associated with a wallet address via the Bulla subgraph. Returns both claims where the user is the creditor and where they are the debtor.

## Context
- **Repo**: bulla-subgraph
- **Endpoint**: Use the GraphQL endpoint from the registry for the target chainId
- **Networks**: all (chainIds: 1, 10, 56, 100, 137, 151, 8453, 42161, 42220, 43114, 11155111)

## Prerequisites
- The user's wallet address (lowercase hex)
- The target chain's GraphQL endpoint URL from the registry

## GraphQL Query
```graphql
query GetUserClaims($userAddress: ID!) {
  user(id: $userAddress) {
    claims(first: 1000, orderBy: created, orderDirection: desc) {
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
      transactionHash
      creditor {
        id
        address
      }
      debtor {
        id
        address
      }
      token {
        address
        symbol
        decimals
      }
      controller {
        address
      }
      lastUpdatedBlockNumber
      lastUpdatedTimestamp
    }
  }
}
```

### Variables
| Name | Type | Description |
|------|------|-------------|
| `userAddress` | `ID!` | The wallet address in lowercase hex (e.g., `"0xabc123..."`) |

### Key Response Fields
| Field | Type | Description |
|-------|------|-------------|
| `id` | `ID` | Format: `TOKENID-VERSION` (e.g., `"42-V1"` or `"15-V2"`) |
| `version` | `BullaClaimVersion` | `V1` or `V2` |
| `claimType` | `ClaimType` | `Invoice` or `Payment` |
| `status` | `ClaimStatus` | `Pending`, `Paid`, `Rejected`, `Rescinded`, `Repaying`, or `Impaired` |
| `binding` | `ClaimBinding` | `Unbound`, `BindingPending`, or `Bound` |
| `amount` | `BigInt` | Total claim amount in token's smallest unit |
| `paidAmount` | `BigInt` | Amount paid so far |
| `dueBy` | `BigInt` | Unix timestamp for due date |
| `token.symbol` | `String` | Token symbol (e.g., `"USDC"`) |
| `token.decimals` | `Int` | Token decimals for formatting |

## Steps
1. Look up the GraphQL endpoint URL for the target chainId from the registry
2. The user ID in the subgraph is the **lowercase** wallet address
3. Send a POST request to the endpoint with the query and variables
4. Parse the `user.claims` array from the response

## Example
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"query": "query GetUserClaims($userAddress: ID!) { user(id: $userAddress) { claims(first: 1000, orderBy: created, orderDirection: desc) { id version tokenId claimType status amount paidAmount dueBy created token { symbol decimals address } creditor { address } debtor { address } } } }", "variables": {"userAddress": "0x1234abcd..."}}' \
  https://api.goldsky.com/api/public/project_clxvwihx9eci401ud1suddgpf/subgraphs/bulla-contracts-mainnet/v2-main/gn
```

## Common Errors
- User not found: Returns `null` for `user` — the address has no claims on this chain
- Address not lowercase: The subgraph uses lowercase addresses as IDs; uppercase will return null
- Pagination: Default `first: 1000` limit. For users with more claims, use `skip` parameter for pagination
