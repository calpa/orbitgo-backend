# 🔌 OrbitGO API Documentation

## Authentication

- Requires an API key from [1inch Portal](https://portal.1inch.dev)
- Rate limit: 10 requests per second (increased for hackathon promotion, normally 1 RPS)

## Portfolio Endpoints

### Get Portfolio Data
```http
GET /portfolio/:address
```

Returns aggregated portfolio data across all supported chains for the given address. This endpoint automatically triggers data fetching for all chains and returns the aggregated result.

#### Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| address | `string` | Ethereum address (must start with '0x') |

#### Response
```json
{
  "totalValueUsd": 1000.00,
  "chains": [
    {
      "id": 1,
      "name": "Ethereum",
      "status": "completed",
      "data": {
        "result": [
          {
            "value_usd": 500.00
          }
        ]
      }
    }
  ],
  "positions": [
    {
      "value_usd": 500.00
    }
  ]
}
```

### Fetch Single Chain Data
```http
POST /portfolio/fetch
```

Enqueues a request to fetch portfolio data for a specific chain.

#### Request Body
```json
{
  "chainId": 1,
  "address": "0x..."
}
```

#### Response
```json
{
  "requestId": "uuid-v4"
}
```

### Fetch All Chains
```http
POST /portfolio/fetch/all
```

Enqueues requests to fetch portfolio data for all supported chains.

#### Request Body
```json
{
  "address": "0x..."
}
```

#### Response
```json
{
  "requestIds": ["uuid-v4", "uuid-v4"]
}
```

### Check Request Status
```http
GET /portfolio/status/:requestId
```

Checks the status of a portfolio data fetch request.

#### Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| requestId | `string` | UUID of the fetch request |

#### Response
```json
{
  "status": "completed",
  "data": {
    "result": [
      {
        "value_usd": 500.00
      }
    ]
  }
}
```

### Get Value Chart
```http
GET /portfolio/:address/value-chart
```

Returns historical value chart data for an address.

#### Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| address | `string` | Ethereum address (must start with '0x') |

#### Query Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| chainId | `number` | Optional chain ID to filter by |
| timerange | `string` | Time range ('1day', '1week', '1month', '1year', 'all'). Default: '1month' |
| useCache | `boolean` | Whether to use cached data. Default: true |

#### Response
```json
{
  "result": [
    {
      "timestamp": 1649289600,
      "value": 1000.00
    }
  ]
}
```

### Get Transaction History
```http
GET /portfolio/:address/history
```

Returns transaction history for an address.

#### Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| address | `string` | Ethereum address (must start with '0x') |

#### Query Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| chainId | `number` | Optional chain ID to filter by |
| limit | `number` | Max number of events. Default: 100 |
| tokenAddress | `string` | Optional token address to filter by |
| fromTimestampMs | `number` | Optional start timestamp in milliseconds |
| toTimestampMs | `number` | Optional end timestamp in milliseconds |

#### Response
```json
{
  "items": [
    {
      "timeMs": 1649289600000,
      "address": "0x...",
      "type": 1,
      "rating": "Reliable",
      "direction": "in",
      "details": {
        "txHash": "0x...",
        "chainId": 1,
        "blockNumber": 1000000,
        "tokenActions": [
          {
            "chainId": "1",
            "address": "0x...",
            "standard": "ERC20",
            "amount": "1000000000000000000",
            "direction": "In"
          }
        ]
      }
    }
  ]
}
```

## Token API

### Get Tokens Owned By Account
```http
POST /token/:protocol/:network/tokens/owned
```

Retrieves a list of tokens held by a specific account, including balances and token contract metadata.

#### Parameters
- `protocol` (path) - The protocol to query (e.g., ethereum)
- `network` (path) - The network to query (e.g., mainnet)

#### Request Body
```json
{
  "accountAddress": "0x1234...",          // Required: Account address to query
  "contractAddresses": ["0x1234..."],  // Optional: Filter by specific token contracts
  "page": 1,                           // Optional: Page number (1-100)
  "rpp": 20,                          // Optional: Results per page (1-1000)
  "cursor": "abc...",                  // Optional: Cursor for pagination
  "withCount": false                   // Optional: Include total count
}
```

#### Response
```json
{
  "rpp": 20,
  "cursor": "abc...",
  "items": [
    {
      "ownerAddress": "0x1234...",
      "balance": "1000000000000000000",
      "contract": {
        "address": "0x1234...",
        "name": "Token",
        "symbol": "TKN",
        "decimals": 18,
        "totalSupply": "1000000000000000000000000",
        "type": "ERC20"
      }
    }
  ]
}
```

## Webhook API

### Create Webhook
```http
POST /webhook/:protocol/:network/webhooks
```

Create a new webhook subscription for monitoring blockchain events.

#### Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| protocol | `string` | Protocol to monitor (ethereum, arbitrum, base, etc.) |
| network | `string` | Network to monitor (mainnet, testnet, sepolia, etc.) |

#### Request Body
```json
{
  "eventType": "SUCCESSFUL_TRANSACTION",
  "description": "Webhook for successful transaction",
  "notification": {
    "webhookUrl": "https://example.com/webhook"
  },
  "condition": {
    "addresses": ["0x..."] 
  }
}
```

#### Response (201 Created)
```json
{
  "subscriptionId": "uuid-v4",
  "description": "Webhook for successful transaction",
  "protocol": "ethereum",
  "network": "mainnet",
  "eventType": "SUCCESSFUL_TRANSACTION",
  "notification": {
    "webhookUrl": "https://example.com/webhook",
    "signingKey": "signing-key"
  },
  "createdAt": "2024-04-05T09:41:36Z",
  "condition": {
    "addresses": ["0x..."]
  }
}
```

### Delete Webhook
```http
DELETE /webhook/:protocol/:network/webhooks/:subscriptionId
```

Delete an existing webhook subscription.

#### Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| protocol | `string` | Protocol of the webhook |
| network | `string` | Network of the webhook |
| subscriptionId | `string` | ID of the webhook subscription |

#### Response
```json
{
  "message": "Webhook deleted successfully"
}
```
