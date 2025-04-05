import axios from "axios";
import {
  PortfolioResponse,
  QueuedRequest,
  Chain,
  SupportedChains,
} from "../types/inch";
import supportedChains from "../constants/supported_chains.json" assert { type: "json" };
import { createContextLogger } from "./logger";

const INCH_API_URL = "https://api.1inch.dev";
const RETRY_DELAY = 1000; // 1 second
const MAX_RETRIES = 3;

interface AggregatedPortfolio {
  protocols: {
    [chainId: number]: PortfolioResponse["protocols"];
  };
  timestamp: number;
  address: string;
  chains: {
    id: number;
    name: string;
    status: "completed" | "failed" | "not_found";
    error?: string;
  }[];
}

export class InchService {
  private logger = createContextLogger("inchService.ts", "InchService");
  private queue: QueuedRequest[] = [];
  private processing = false;
  private env: any;

  constructor(env: any) {
    this.env = env;
  }

  async enqueueMultichainPortfolioRequest(
    address: `0x${string}`
  ): Promise<string[]> {
    this.logger.info({ address }, "Starting multichain portfolio request");
    const chains = (supportedChains as SupportedChains).result;
    this.logger.debug({ chainCount: chains.length }, "Processing chains");

    return Promise.all(
      chains.map((chain: Chain) => {
        this.logger.debug(
          { chainId: chain.id, chainName: chain.name },
          "Enqueueing chain request"
        );
        return this.enqueuePortfolioRequest(chain.id, address);
      })
    );
  }

  async enqueuePortfolioRequest(
    chainId: number,
    address: `0x${string}`
  ): Promise<string> {
    const requestId = crypto.randomUUID();
    const request: QueuedRequest = {
      chainId,
      address,
      requestId,
      retryCount: 0,
      timestamp: Date.now(),
    };

    this.logger.info(
      { requestId, chainId, address },
      "Enqueueing portfolio request"
    );
    this.queue.push(request);

    this.logger.debug(
      { queueLength: this.queue.length },
      "Current queue status"
    );

    // Start processing if not already running
    if (!this.processing) {
      this.logger.debug({}, "Starting queue processing");
      this.processQueue();
    }

    return requestId;
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;
    this.logger.info(
      { queueLength: this.queue.length },
      "Starting queue processing"
    );

    while (this.queue.length > 0) {
      const request = this.queue[0];
      this.logger.debug(
        { requestId: request.requestId, chainId: request.chainId },
        "Processing request"
      );

      try {
        const startTime = Date.now();
        const data = await this.fetchPortfolioData(
          request.chainId,
          request.address
        );
        const duration = Date.now() - startTime;

        this.logger.info(
          { requestId: request.requestId, chainId: request.chainId, duration },
          "Successfully fetched portfolio data"
        );

        await this.env.PORTFOLIO_KV.put(
          request.requestId,
          JSON.stringify({
            status: "completed",
            data,
            timestamp: Date.now(),
          })
        );
        this.queue.shift(); // Remove processed request
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";
        this.logger.error(
          {
            requestId: request.requestId,
            chainId: request.chainId,
            error: errorMessage,
            retryCount: request.retryCount,
          },
          "Error fetching portfolio data"
        );

        if (request.retryCount < MAX_RETRIES) {
          request.retryCount++;
          // Move to end of queue for retry
          this.queue.shift();
          this.queue.push(request);
          this.logger.info(
            {
              requestId: request.requestId,
              chainId: request.chainId,
              retryCount: request.retryCount,
            },
            "Retrying request"
          );
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
        } else {
          await this.env.PORTFOLIO_KV.put(
            request.requestId,
            JSON.stringify({
              status: "failed",
              error: errorMessage,
              timestamp: Date.now(),
            })
          );
          this.logger.warn(
            { requestId: request.requestId, chainId: request.chainId },
            "Max retries reached, marking as failed"
          );
          this.queue.shift();
        }
      }

      // Rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 RPS limit
    }

    this.processing = false;
  }

  private async fetchPortfolioData(chainId: number, address: `0x${string}`) {
    const response = await axios.get<PortfolioResponse>(
      `${INCH_API_URL}/portfolio/portfolio/v4/overview/protocols/details`,
      {
        headers: {
          Authorization: `Bearer ${this.env.INCH_API_KEY}`,
        },
        params: {
          chain_id: chainId,
          addresses: address,
        },
      }
    );
    return response.data;
  }

  async getRequestStatus(requestId: string) {
    this.logger.debug({ requestId }, "Checking request status");
    const data = await this.env.PORTFOLIO_KV.get(requestId);

    if (!data) {
      const queuePosition = this.queue.findIndex(
        (r) => r.requestId === requestId
      );
      const status =
        queuePosition !== -1
          ? { status: "queued", position: queuePosition + 1 }
          : { status: "not_found" };

      this.logger.debug({ requestId, status }, "Request status");
      return status;
    }

    const parsedData = JSON.parse(data);
    this.logger.debug(
      { requestId, status: parsedData.status },
      "Request status from KV"
    );
    return parsedData;
  }

  async getAggregatedPortfolio(
    address: `0x${string}`
  ): Promise<AggregatedPortfolio> {
    this.logger.debug({ address }, "Aggregating portfolio data across chains");
    const chains = (supportedChains as SupportedChains).result;

    const result: AggregatedPortfolio = {
      protocols: {},
      timestamp: Date.now(),
      address,
      chains: [],
    };

    // Search for the most recent request IDs for this address
    const searchPattern = `${address}-*`;
    const keys = await this.env.PORTFOLIO_KV.list({ prefix: searchPattern });

    this.logger.debug(
      { address, keyCount: keys.keys.length },
      "Found portfolio data keys"
    );

    // Process each chain's data
    for (const chain of chains) {
      try {
        const key = keys.keys.find((k: { name: string }) =>
          k.name.includes(`-${chain.id}-`)
        );
        if (!key) {
          result.chains.push({
            id: chain.id,
            name: chain.name,
            status: "not_found",
          });
          continue;
        }

        const data = await this.env.PORTFOLIO_KV.get(key.name);
        if (!data) continue;

        const parsedData = JSON.parse(data);
        if (parsedData.status === "completed") {
          result.protocols[chain.id] = parsedData.data.protocols;
          result.chains.push({
            id: chain.id,
            name: chain.name,
            status: "completed",
          });
        } else if (parsedData.status === "failed") {
          result.chains.push({
            id: chain.id,
            name: chain.name,
            status: "failed",
            error: parsedData.error,
          });
        }
      } catch (error) {
        this.logger.error(
          {
            chainId: chain.id,
            error: error instanceof Error ? error.message : "Unknown error",
          },
          "Error aggregating chain data"
        );
        result.chains.push({
          id: chain.id,
          name: chain.name,
          status: "failed",
          error: "Internal error while aggregating data",
        });
      }
    }

    this.logger.info(
      {
        address,
        chainCount: result.chains.length,
        completedChains: result.chains.filter((c) => c.status === "completed")
          .length,
      },
      "Portfolio aggregation completed"
    );

    return result;
  }
}
