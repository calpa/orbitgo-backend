# 🔌 OrbitGO API Documentation

## Authentication

- Requires an API key from [1inch Portal](https://portal.1inch.dev)
- Rate limit: 10 requests per second (increased for hackathon promotion, normally 1 RPS)

## Portfolio Endpoints

### Get Portfolio Data
```http
GET /portfolio/:address
```

Returns aggregated portfolio data across all supported chains for the given address.

#### Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| address | `string` | Ethereum address to fetch portfolio for |

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

#### Query Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| chainId | `number` | Optional chain ID to filter by |
| timerange | `string` | Optional time range ('1day', '1week', '1month', '1year', 'all') |
| useCache | `boolean` | Optional, whether to use cached data |

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

#### Query Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| chainId | `number` | Optional chain ID to filter by |
| limit | `number` | Optional max number of events (default: 100) |
| tokenAddress | `string` | Optional token address to filter by |
| fromTimestampMs | `number` | Optional start timestamp |
| toTimestampMs | `number` | Optional end timestamp |

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

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request
```json
{
  "error": "Invalid address format"
}
```

### 401 Unauthorized
```json
{
  "error": "Invalid API key"
}
```

### 429 Too Many Requests
```json
{
  "error": "Rate limit exceeded"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error"
}
```
