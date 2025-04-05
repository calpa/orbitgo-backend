# Treasury Management Backend

A Cloudflare Workers service that aggregates portfolio data across multiple chains using the 1inch Portfolio API. Built with TypeScript, Hono, and Cloudflare Workers.

## Features

- Multi-chain portfolio aggregation
- Queue-based processing to handle rate limits
- KV storage for caching responses
- Structured logging with pino-pretty
- TypeScript for type safety

## Supported Chains

- Ethereum (1)
- BSC (56)
- Polygon (137)
- Arbitrum (42161)
- Optimism (10)
- Avalanche (43114)
- Base (8453)
- zkSync Era (324)
- Linea (59144)

## API Endpoints

### Get Portfolio Data
```
GET /portfolio/:address
```
Returns aggregated portfolio data across all supported chains for the given address.

### Fetch Single Chain Data
```
POST /portfolio/fetch
Body: { chainId: number, address: string }
```
Enqueues a request to fetch portfolio data for a specific chain.

### Fetch All Chains
```
POST /portfolio/fetch/all
Body: { address: string }
```
Enqueues requests to fetch portfolio data for all supported chains.

### Check Request Status
```
GET /portfolio/status/:requestId
```
Checks the status of a portfolio data fetch request.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
```
INCH_API_KEY=your_api_key_here
```

3. Run locally:
```bash
npm run dev
```

## Deployment

Deploy to Cloudflare Workers:
```bash
npm run deploy
```

## Development

- `src/index.ts`: Main application entry point and API routes
- `src/services/inchService.ts`: Core service for interacting with 1inch API
- `src/utils/logger.ts`: Structured logging configuration
- `src/types/inch.ts`: TypeScript interfaces for API responses

## Queue Processing

The service uses Cloudflare Queue to handle rate limiting when fetching portfolio data:
1. Requests are enqueued with chain and address information
2. Queue processor fetches data from 1inch API
3. Results are stored in KV with format: `portfolio-{address}-{chainId}-{requestId}`
4. Aggregation endpoint combines data from KV storage

## Error Handling

- Failed requests are stored in KV with error information
- Rate limiting is implemented (1 request per second)
- Detailed error logging with context
- Proper HTTP status codes for API responses
