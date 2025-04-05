import { Hono } from "hono";
import { createContextLogger } from "../utils/logger";
import { InchService } from "../services/inchService";
import { Environment } from "../types/environment";
import { TimeRange, ValueChartResponse } from "../types/inch";
import supportedChains from "../constants/supported_chains.json";

const portfolio = new Hono<{ Bindings: Environment }>();
const logger = createContextLogger("/src/routes/portfolio.ts", "portfolio");

/**
 * Fetch portfolio data for a single chain
 * @route POST /fetch
 */
portfolio.post("/fetch", async (c) => {
  const routeLogger = createContextLogger("portfolio.ts", "portfolio.fetch");
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
 * @route POST /fetch/all
 */
portfolio.post("/fetch/all", async (c) => {
  const routeLogger = createContextLogger("portfolio.ts", "portfolio.fetchAll");
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
 * @route GET /status/:requestId
 */
portfolio.get("/status/:requestId", async (c) => {
  const routeLogger = createContextLogger("portfolio.ts", "portfolio.status");
  const inchService = c.get("inchService");
  const requestId = c.req.param("requestId");

  routeLogger.debug({ requestId }, "Checking portfolio request status");
  const status = await inchService.getRequestStatus(requestId);

  routeLogger.debug({ requestId, status }, "Portfolio status retrieved");
  return c.json(status);
});

/**
 * Get aggregated portfolio data across all chains for an address
 * @route GET /:address
 */
portfolio.get("/:address", async (c) => {
  const routeLogger = createContextLogger("portfolio.ts", "portfolio.get");
  const inchService = c.get("inchService");
  const address = c.req.param("address") as `0x${string}`;

  if (!address.startsWith("0x")) {
    return c.json({ error: "Invalid address format" }, 400);
  }

  routeLogger.debug({ address }, "Fetching aggregated portfolio data");
  const data = await inchService.aggregatePortfolio(
    address,
    c.env,
    "portfolio.get"
  );

  routeLogger.debug(
    { address, chainCount: data.chains.length },
    "Aggregated portfolio data retrieved"
  );
  return c.json(data);
});

/**
 * Get value chart data for an address for all chains
 * @route GET /:address/value-chart
 */
portfolio.get("/:address/value-chart", async (c) => {
  const routeLogger = createContextLogger(
    "portfolio.ts",
    "portfolio.valueChart"
  );
  const inchService = c.get("inchService");
  const address = c.req.param("address") as `0x${string}`;

  if (!address.startsWith("0x")) {
    return c.json({ error: "Invalid address format" }, 400);
  }

  const timerange = (c.req.query("timerange") || "1month") as TimeRange;
  const useCache = c.req.query("useCache") !== "false";

  routeLogger.debug(
    { address, timerange, useCache },
    "Fetching value chart data"
  );

  // Get All Chains instead of just one chain
  const chains = supportedChains.result;

  const result: {
    [chainId: number]: ValueChartResponse["result"];
  } = {};

  await Promise.all(
    chains.map(async (chain) => {
      try {
        const data = await inchService.getValueChart(
          address,
          chain.id,
          timerange,
          useCache
        );
        routeLogger.debug(
          { address, chainId: chain.id, dataPoints: data.result.length },
          "Value chart data retrieved"
        );
        result[chain.id] = data.result;
      } catch (error) {
        routeLogger.error(
          {
            address,
            chainId: chain.id,
            error: error instanceof Error ? error.message : "Unknown error",
          },
          "Failed to fetch value chart data"
        );
      }
    })
  );

  return c.json({
    message: "Value chart data retrieved",
    address,
    timerange,
    useCache,
    result,
  });
});

/**
 * Check the status of a portfolio data fetch request
 * @route GET /status/:requestId
 */
portfolio.get("/status/:requestId", async (c) => {
  const routeLogger = createContextLogger("portfolio.ts", "portfolio.status");
  const inchService = c.get("inchService");
  const requestId = c.req.param("requestId");

  routeLogger.debug({ requestId }, "Checking portfolio request status");
  const status = await inchService.getRequestStatus(requestId);

  routeLogger.debug({ requestId, status }, "Portfolio status retrieved");
  return c.json(status);
});

/**
 * Get transaction history for an address
 * @route GET /:address/history
 */
portfolio.get("/:address/history", async (c) => {
  const routeLogger = createContextLogger("portfolio.ts", "portfolio.history");
  const inchService = c.get("inchService");
  const address = c.req.param("address") as `0x${string}`;

  // Get query parameters
  const { searchParams } = new URL(c.req.url);
  const chainId = searchParams.get("chainId")
    ? parseInt(searchParams.get("chainId")!)
    : undefined;
  const limit = searchParams.get("limit")
    ? parseInt(searchParams.get("limit")!)
    : undefined;
  const tokenAddress = searchParams.get("tokenAddress") || undefined;
  const fromTimestampMs = searchParams.get("fromTimestampMs")
    ? parseInt(searchParams.get("fromTimestampMs")!)
    : undefined;
  const toTimestampMs = searchParams.get("toTimestampMs")
    ? parseInt(searchParams.get("toTimestampMs")!)
    : undefined;

  routeLogger.debug(
    { address, chainId, limit, tokenAddress, fromTimestampMs, toTimestampMs },
    "Getting transaction history"
  );

  const history = await inchService.getHistory(
    address,
    chainId,
    limit,
    tokenAddress,
    fromTimestampMs,
    toTimestampMs
  );

  routeLogger.debug(
    { address, eventCount: history.items.length },
    "Transaction history retrieved"
  );

  return c.json(history);
});

export { portfolio };
