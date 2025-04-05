import { Hono } from "hono";
import { cors } from "hono/cors";
import { InchService } from "./services/inchService";
import { createContextLogger } from "./utils/logger";
import { timing } from "hono/timing";

type Environment = {
  INCH_API_KEY: string;
  PORTFOLIO_KV: KVNamespace;
  portfolio_queue: Queue<PortfolioQueueMessage>;
};

interface PortfolioQueueMessage {
  chainId: number;
  address: `0x${string}`;
  requestId: string;
}

const app = new Hono<{ Bindings: Environment }>();
const logger = createContextLogger("/src/index.ts", "middleware");

// Initialize InchService for each request
// Add request timing
app.use(timing());

// Add request logging
app.use("*", async (c, next) => {
  const method = c.req.method;
  const path = c.req.path;
  const startTime = Date.now();

  // Log request details
  const requestBody = ["POST", "PUT", "PATCH"].includes(method)
    ? await c.req.json()
    : undefined;
  logger.info({ method, path, body: requestBody }, "Incoming request");

  try {
    await next();
    const duration = Date.now() - startTime;
    const status = c.res.status;

    // Clone the response to log its body
    const response = c.res;
    const responseBody = response.headers
      .get("content-type")
      ?.includes("application/json")
      ? await c.res.clone().json()
      : undefined;

    logger.info(
      { method, path, status, duration, body: responseBody },
      "Request completed"
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    logger.error(
      { method, path, error: errorMessage, duration },
      "Request failed"
    );
    throw error;
  }
});

// Initialize InchService
app.use("*", async (c, next) => {
  c.set("inchService", new InchService(c.env));
  await next();
});

app.get("/", async (c) => {
  return c.json({ message: "Hello, World!" });
});

/**
 * Fetch portfolio data for a single chain
 * @route POST /portfolio/fetch
 * @param {object} requestBody - Request body
 * @param {number} requestBody.chainId - Chain ID (e.g., 1 for Ethereum, 137 for Polygon)
 * @param {string} requestBody.address - Ethereum address starting with 0x
 * @returns {object} Response object
 * @returns {string} response.requestId - Unique ID to track the request status
 * @example
 * // Request
 * POST /portfolio/fetch
 * {
 *   "chainId": 1,
 *   "address": "0x123..."
 * }
 *
 * // Response
 * {
 *   "requestId": "uuid-v4"
 * }
 */
app.post("/portfolio/fetch", async (c) => {
  const routeLogger = createContextLogger("index.ts", "portfolio.fetch");
  const inchService = c.get("inchService");
  const { chainId, address } = await c.req.json<{
    chainId: number;
    address: `0x${string}`;
  }>();

  routeLogger.debug(
    { chainId, address },
    "Processing single chain portfolio request"
  );
  const requestId = await inchService.enqueuePortfolioRequest(chainId, address);

  const response = { requestId };
  routeLogger.debug({ response }, "Single chain portfolio request enqueued");
  return c.json(response);
});

/**
 * Fetch portfolio data for all supported chains
 * @route POST /portfolio/fetch/all
 * @param {object} requestBody - Request body
 * @param {string} requestBody.address - Ethereum address starting with 0x
 * @returns {object} Response object
 * @returns {string[]} response.requestIds - Array of request IDs, one for each chain
 * @example
 * // Request
 * POST /portfolio/fetch/all
 * {
 *   "address": "0x123..."
 * }
 *
 * // Response
 * {
 *   "requestIds": ["uuid-for-eth", "uuid-for-polygon", ...]
 * }
 */
app.post("/portfolio/fetch/all", async (c) => {
  const routeLogger = createContextLogger("index.ts", "portfolio.fetchAll");
  const inchService = c.get("inchService");
  const { address } = await c.req.json<{ address: `0x${string}` }>();

  routeLogger.debug({ address }, "Processing multichain portfolio request");
  const requestIds = await inchService.enqueueMultichainPortfolioRequest(
    address
  );

  const response = { requestIds };
  routeLogger.debug({ response }, "Multichain portfolio requests enqueued");
  return c.json(response);
});

/**
 * Check the status of a portfolio data fetch request
 * @route GET /portfolio/status/:requestId
 * @param {string} requestId - Request ID returned from fetch endpoints
 * @returns {PortfolioStatus} Status object
 * @returns {string} status.status - One of: 'queued', 'completed', 'failed'
 * @returns {object} [status.data] - Portfolio data if status is 'completed'
 * @returns {string} [status.error] - Error message if status is 'failed'
 * @returns {number} [status.position] - Position in queue if status is 'queued'
 * @returns {number} [status.timestamp] - Timestamp of last status update
 * @example
 * // Request
 * GET /portfolio/status/uuid-v4
 *
 * // Response (queued)
 * {
 *   "status": "queued",
 *   "position": 3
 * }
 *
 * // Response (completed)
 * {
 *   "status": "completed",
 *   "data": { "protocols": [...] },
 *   "timestamp": 1234567890
 * }
 *
 * // Response (failed)
 * {
 *   "status": "failed",
 *   "error": "Rate limit exceeded",
 *   "timestamp": 1234567890
 * }
 */
app.get("/portfolio/status/:requestId", async (c) => {
  const routeLogger = createContextLogger("index.ts", "portfolio.status");
  const inchService = c.get("inchService");
  const requestId = c.req.param("requestId");

  routeLogger.debug({ requestId }, "Checking portfolio request status");
  const status = await inchService.getRequestStatus(requestId);

  routeLogger.debug({ requestId, status }, "Portfolio status retrieved");
  return c.json(status);
});

/**
 * Get aggregated portfolio data across all chains for an address
 * @route GET /portfolio/:address
 * @param {string} address - Ethereum address starting with 0x
 * @returns {object} Response object
 * @returns {object} response.protocols - Portfolio data by chain ID
 * @returns {number} response.timestamp - Timestamp of the aggregation
 * @returns {string} response.address - The queried address
 * @returns {object[]} response.chains - Status of each chain
 * @returns {number} response.chains[].id - Chain ID
 * @returns {string} response.chains[].name - Chain name
 * @returns {string} response.chains[].status - Status of data fetch (completed/failed/not_found)
 * @returns {string} [response.chains[].error] - Error message if status is failed
 * @example
 * // Request
 * GET /portfolio/0x123...
 *
 * // Response
 * {
 *   "protocols": {
 *     "1": [...],
 *     "137": [...]
 *   },
 *   "timestamp": 1234567890,
 *   "address": "0x123...",
 *   "chains": [
 *     { "id": 1, "name": "Ethereum", "status": "completed" },
 *     { "id": 137, "name": "Polygon", "status": "completed" },
 *     { "id": 56, "name": "BSC", "status": "failed", "error": "Rate limit exceeded" }
 *   ]
 * }
 */
app.get("/portfolio/:address", async (c) => {
  const routeLogger = createContextLogger("index.ts", "portfolio.get");
  const inchService = c.get("inchService");
  const address = c.req.param("address") as `0x${string}`;

  if (!address.startsWith("0x")) {
    return c.json({ error: "Invalid address format" }, 400);
  }

  routeLogger.debug({ address }, "Fetching aggregated portfolio data");
  const data = await inchService.aggregatePortfolio(address);

  routeLogger.debug(
    { address, chainCount: data.chains.length },
    "Aggregated portfolio data retrieved"
  );
  return c.json(data);
});

export default {
  fetch: app.fetch,
  async queue(batch: MessageBatch<PortfolioQueueMessage>, env: Environment) {
    const logger = createContextLogger("index.ts", "queue.processor");
    const inchService = new InchService(env);

    for (const message of batch.messages) {
      const { chainId, address, requestId } = message.body;

      try {
        logger.info(
          { chainId, address, requestId },
          "Processing queued portfolio request"
        );
        const startTime = Date.now();

        const data = await inchService.fetchPortfolioData(chainId, address);
        const duration = Date.now() - startTime;

        logger.info(
          { chainId, address, requestId, duration },
          "Successfully processed portfolio request"
        );

        const key = `portfolio-${address}-${chainId}-${requestId}`;
        await env.PORTFOLIO_KV.put(
          key,
          JSON.stringify({
            status: "completed",
            data,
            timestamp: Date.now(),
          })
        );

        logger.info(
          { chainId, address, requestId, key },
          "Portfolio data saved to KV"
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        logger.error(
          { chainId, address, requestId, error: errorMessage },
          "Failed to process portfolio request"
        );

        const key = `portfolio-${address}-${chainId}-${requestId}`;
        await env.PORTFOLIO_KV.put(
          key,
          JSON.stringify({
            status: "failed",
            error: errorMessage,
            timestamp: Date.now(),
          })
        );

        logger.info(
          { chainId, address, requestId, key, error: errorMessage },
          "Failed to process portfolio request"
        );
      }

      // Rate limiting - 1 RPS
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  },
};
