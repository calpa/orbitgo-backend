import { MessageBatch } from "@cloudflare/workers-types";
import { createContextLogger } from "../utils/logger";
import { InchService } from "../services/inchService";
import { Environment } from "../types/environment";
import { PortfolioQueueMessage } from "../types/inch";

export async function handlePortfolioQueue(
  batch: MessageBatch<PortfolioQueueMessage>,
  env: Environment
) {
  const logger = createContextLogger("portfolioQueue.ts", "queue.processor");
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
}
