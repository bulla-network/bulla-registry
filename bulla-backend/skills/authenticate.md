# Authenticate

## Description
Authenticate a wallet address with the Bulla backend using Sign-In with Ethereum (SIWE). The flow produces a JWT cookie that authorizes subsequent API calls. Two-step process: get a nonce message, then sign and verify it.

## Context
- **Repo**: bulla-backend
- **Base URL**: `https://backend.bulla.network` (prod) or `https://dev-backend.bulla.network` (dev)
- **Networks**: chain-agnostic (wallet address only, no chain requirement)

## Prerequisites
- A wallet address with signing capability (e.g., MetaMask, ethers.js Wallet)
- The ability to perform `personal_sign` (EIP-191) on the returned message

## API Endpoints

### Step 1: Get Message
```
GET /auth/{walletAddress}/getMessage
```

Returns a SIWE-formatted message containing a unique nonce.

#### Response
```json
{
  "message": "Bulla Banker wants you to sign in with your Ethereum account:\n0x1234...\n\nURI: https://banker.bulla.network/#/onboard\nVersion: 2\nNonce: 12345678\nChain ID: 1\nIssued At: 2026-02-23T12:00:00.000Z"
}
```

### Step 2: Verify Signature
```
POST /auth/{walletAddress}/verifyMessage
Content-Type: text/plain
Body: <signature>
```

The body is the raw hex signature string from `personal_sign`.

#### Response (success)
```json
{
  "message": "<jwt_token>"
}
```

The response also includes a `Set-Cookie` header:
```
{env}-{walletAddress}-bulla-jwt={token}; Max-Age={expiry}; SameSite=None; Secure; Domain=.bulla.network; path=/;
```

## Steps
1. Call `GET /auth/{walletAddress}/getMessage` to retrieve the nonce message
2. Sign the message using `personal_sign` (EIP-191) with the wallet's private key
3. Call `POST /auth/{walletAddress}/verifyMessage` with the signature as the request body
4. The response contains a JWT token and sets a cookie for subsequent requests
5. Store the JWT token or cookie for use in authenticated API calls

## Example
```javascript
// Step 1: Get the message to sign
const response = await fetch(
  `https://backend.bulla.network/auth/${walletAddress}/getMessage`
);
const { message } = await response.json();

// Step 2: Sign the message (using ethers.js)
const signature = await wallet.signMessage(message);

// Step 3: Verify the signature
const verifyResponse = await fetch(
  `https://backend.bulla.network/auth/${walletAddress}/verifyMessage`,
  {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: signature,
  }
);
const { message: jwtToken } = await verifyResponse.json();

// The JWT cookie is also set automatically in the response headers
```

## JWT Payload Structure
```json
{
  "iss": "https://banker.bulla.network",
  "exp": 1234567890,
  "wallet": "0x1234...",
  "membership": { "exp": 1234567890, "isFreeTrial": false },
  "memberships": [{ "id": "guid", "exp": 1234567890, "tier": "basic" }]
}
```

## Common Errors
- Nonce not found: The nonce expired or was already used. Call `getMessage` again.
- Did not recover expected address: The signature was created by a different wallet than the one in the URL.
- Invalid signature format: The body must be the raw hex signature string (starting with `0x`).
- Expired token: JWT tokens expire based on membership status. Re-authenticate when expired.
