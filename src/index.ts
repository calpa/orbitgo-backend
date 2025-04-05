import { Hono } from "hono";
import { InchService } from "./services/inchService";
import { createContextLogger } from "./services/logger";
import { timing } from "hono/timing";

const logger = createContextLogger('index.ts', 'middleware');

type Bindings = {
  INCH_API_KEY: string;
  PORTFOLIO_KV: KVNamespace;
};

const app = new Hono<{ Bindings: Bindings }>();

// Initialize InchService for each request
// Add request timing
app.use(timing());

// Add request logging
app.use("*", async (c, next) => {
  const method = c.req.method;
  const path = c.req.path;
  const startTime = Date.now();

  // Log request details
  const requestBody = ['POST', 'PUT', 'PATCH'].includes(method) ? await c.req.json() : undefined;
  logger.info({ method, path, body: requestBody }, "Incoming request");

  try {
    await next();
    const duration = Date.now() - startTime;
    const status = c.res.status;

    // Clone the response to log its body
    const response = c.res;
    const responseBody = response.headers.get('content-type')?.includes('application/json')
      ? await c.res.clone().json()
      : undefined;

    logger.info(
      { method, path, status, duration, body: responseBody },
      "Request completed"
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

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
  const routeLogger = createContextLogger('index.ts', 'portfolio.fetch');
  const inchService = c.get("inchService");
  const { chainId, address } = await c.req.json<{
    chainId: number;
    address: `0x${string}`;
  }>();

  routeLogger.debug({ chainId, address }, "Processing single chain portfolio request");
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
  const routeLogger = createContextLogger('index.ts', 'portfolio.fetchAll');
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
  const routeLogger = createContextLogger('index.ts', 'portfolio.status');
  const inchService = c.get("inchService");
  const requestId = c.req.param("requestId");

  routeLogger.debug({ requestId }, "Checking portfolio request status");
  const status = await inchService.getRequestStatus(requestId);
  
  routeLogger.debug({ requestId, status }, "Portfolio status retrieved");
  return c.json(status);
});

export default app;
