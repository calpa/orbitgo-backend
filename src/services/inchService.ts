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
  totalValueUsd: number;
  chains: ChainStatus[];
  positions: PortfolioPosition[];
}

interface ChainStatus {
  id: number;
  name: string;
  status: "completed" | "failed" | "not_found" | "queued";
  error?: string;
  data?: PortfolioResponse;
}

interface MultiChainResponse {
  chains: ChainStatus[];
  totalValueUsd: number;
}

interface PortfolioPosition {
  value_usd: number;
}

export class InchService {
  private logger = createContextLogger("inchService.ts", "InchService");

  private env: any;

  private static CHAIN_NAMES: Record<number, string> = {
    1: "Ethereum",
    56: "BSC",
    137: "Polygon",
    42161: "Arbitrum",
    10: "Optimism",
    43114: "Avalanche",
    8453: "Base",
    324: "zkSync Era",
    59144: "Linea",
  };

  public static getSupportedChains(): number[] {
    return Object.keys(this.CHAIN_NAMES).map(Number);
  }

  public static isSupportedChain(chainId: number): boolean {
    return chainId in this.CHAIN_NAMES;
  }

  public static getChainName(chainId: number): string {
    return this.CHAIN_NAMES[chainId] || `Chain ${chainId}`;
  }

  constructor(env: any) {
    this.env = env;
  }

  async enqueueMultichainPortfolioRequest(
    address: `0x${string}`
  ): Promise<string[]> {
    this.logger.info({ address }, "Starting multichain portfolio request");
    const chains = InchService.getSupportedChains();
    this.logger.debug({ chainCount: chains.length }, "Processing chains");

    return Promise.all(
      chains.map((chain: number) => {
        this.logger.debug(
          { chainId: chain, chainName: InchService.getChainName(chain) },
          "Enqueueing chain request"
        );
        return this.enqueuePortfolioRequest(chain, address);
      })
    );
  }

  async enqueuePortfolioRequest(
    chainId: number,
    address: `0x${string}`
  ): Promise<string> {
    const requestId = crypto.randomUUID();

    // Send to queue instead of processing directly
    await this.env.portfolio_queue.send({
      chainId,
      address,
      requestId,
      timestamp: Date.now(),
    });

    this.logger.info(
      { requestId, chainId, address },
      "Portfolio request enqueued to Cloudflare Queue"
    );

    return requestId;
  }

  public async fetchPortfolioData(
    chainId: number,
    address: `0x${string}`
  ): Promise<PortfolioResponse> {
    const url = `https://api.1inch.dev/portfolio/portfolio/v4/overview/protocols/details?chain_id=${chainId}&addresses=${address}`;

    this.logger.info(
      { chainId, address, url },
      "Fetching portfolio data from 1inch API"
    );

    const response = await axios.get<PortfolioResponse>(url, {
      headers: {
        Authorization: `Bearer ${this.env.INCH_API_KEY}`,
        Accept: "application/json",
      },
    });

    // Log summary of positions found
    const positions = response.data.result;
    const totalValue = positions.reduce((sum, pos) => sum + pos.value_usd, 0);

    this.logger.info(
      {
        chainId,
        address,
        positionCount: positions.length,
        totalValueUsd: totalValue,
      },
      "Successfully fetched portfolio data"
    );

    return response.data;
  }

  async getRequestStatus(requestId: string) {
    this.logger.debug({ requestId }, "Checking request status");
    const data = await this.env.PORTFOLIO_KV.get(requestId);

    if (!data) {
      return { status: "not_found" };
    }

    const parsedData = JSON.parse(data);
    this.logger.debug(
      { requestId, status: parsedData.status },
      "Request status from KV"
    );
    return parsedData;
  }

  async aggregatePortfolio(
    address: `0x${string}`
  ): Promise<AggregatedPortfolio> {
    this.logger.debug({ address }, "Aggregating portfolio data across chains");
    const chains = InchService.getSupportedChains();

    const result: AggregatedPortfolio = {
      totalValueUsd: 0,
      chains: [],
      positions: [],
    };

    await Promise.all(
      chains.map(async (chainId) => {
        try {
          const data = await this.fetchPortfolioData(chainId, address);
          result.positions.push(...data.result);

          const chainValue = data.result.reduce(
            (sum, pos) => sum + pos.value_usd,
            0
          );
          result.totalValueUsd += chainValue;

          result.chains.push({
            id: chainId,
            name: InchService.getChainName(chainId),
            status: "completed",
            data: data,
          });
        } catch (error) {
          this.logger.error(
            {
              chainId: chainId,
              error: error instanceof Error ? error.message : "Unknown error",
            },
            "Error aggregating chain data"
          );
          result.chains.push({
            id: chainId,
            name: InchService.getChainName(chainId),
            status: "failed",
            error: "Internal error while aggregating data",
          });
        }
      })
    );

    return result;
  }
}
