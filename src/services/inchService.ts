import axios from "axios";
import {
  HistoryResponse,
  PortfolioResponse,
  TimeRange,
  ValueChartResponse,
} from "../types/inch";
import { createContextLogger } from "../utils/logger";
import { aggregatePortfolio } from "./inch/aggregatePortfolio";
import type { AggregatedPortfolio } from "../types/inch";
import { getValueChart } from "./inch/getValueChart";

export class InchService {
  async getHistory(
    address: `0x${string}`,
    chainId?: number,
    limit: number = 100,
    tokenAddress?: string,
    fromTimestampMs?: number,
    toTimestampMs?: number
  ): Promise<HistoryResponse> {
    const url = new URL(
      `https://api.1inch.dev/history/v2.0/history/${address}/events`
    );

    if (chainId) url.searchParams.append("chainId", chainId.toString());
    if (limit) url.searchParams.append("limit", limit.toString());
    if (tokenAddress) url.searchParams.append("tokenAddress", tokenAddress);
    if (fromTimestampMs)
      url.searchParams.append("fromTimestampMs", fromTimestampMs.toString());
    if (toTimestampMs)
      url.searchParams.append("toTimestampMs", toTimestampMs.toString());

    this.logger.info(
      { address, chainId, limit, tokenAddress, fromTimestampMs, toTimestampMs },
      "Fetching history from 1inch API"
    );

    const response = await axios.get<HistoryResponse>(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.env.INCH_API_KEY}`,
        Accept: "application/json",
      },
    });

    this.logger.info(
      {
        address,
        chainId,
        eventCount: response.data.items.length,
      },
      "Successfully fetched history data"
    );

    return response.data;
  }
  private logger = createContextLogger(
    "/src/services/inchService.ts",
    "InchService"
  );

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

  public getValueChart(
    address: `0x${string}`,
    chainId?: number,
    timerange: TimeRange = "1month",
    useCache: boolean = true
  ): Promise<ValueChartResponse> {
    return getValueChart(
      this.env,
      "getValueChart",
      address,
      chainId,
      timerange,
      useCache
    );
  }

  public aggregatePortfolio(
    address: `0x${string}`,
    env: any,
    context: string
  ): Promise<AggregatedPortfolio> {
    return aggregatePortfolio(address, env, context);
  }
}
