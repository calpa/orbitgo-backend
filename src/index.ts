import { Hono } from "hono";
import { cors } from "hono/cors";
import { timing } from "hono/timing";
import { InchService } from "./services/inchService";
import { createContextLogger } from "./utils/logger";
import { portfolio } from "./routes/portfolio";
import { Environment } from "./types/environment";
import { PortfolioQueueMessage } from "./types/inch";

const app = new Hono<{ Bindings: Environment }>();
const logger = createContextLogger("/src/index.ts", "middleware");

// Initialize InchService for each request
// Add request timing
app.use(timing());

app.use(cors());

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

// Mount portfolio routes
app.route("/portfolio", portfolio);

import { handlePortfolioQueue } from "./queue/portfolioQueue";

export default {
  fetch: app.fetch,
  queue: handlePortfolioQueue,
};
