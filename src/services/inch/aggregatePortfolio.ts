import { createContextLogger } from "../../utils/logger";
import { AggregatedPortfolio } from "../../types/inch";
import { InchService } from "../inchService";

export async function aggregatePortfolio(
  address: `0x${string}`,
  env: any,
  context: string
): Promise<AggregatedPortfolio> {
  const logger = createContextLogger("aggregatePortfolio", context);
  const chains = InchService.getSupportedChains();

  const result: AggregatedPortfolio = {
    totalValueUsd: 0,
    chains: [],
    positions: [],
  };

  // List all keys for this address
  const searchPattern = `portfolio-${address}`;
  const keys = await env.PORTFOLIO_KV.list({ prefix: searchPattern });

  logger.debug(
    { address, keyCount: keys.keys.length },
    "Found portfolio data keys"
  );

  await Promise.all(
    chains.map(async (chainId) => {
      try {
        // Find the most recent data for this chain
        const key = keys.keys
          .filter((k: { name: string }) => k.name.includes(`-${chainId}-`))
          .sort((a: { name: string }, b: { name: string }) =>
            b.name.localeCompare(a.name)
          )[0];

        if (!key) {
          result.chains.push({
            id: chainId,
            name: InchService.getChainName(chainId),
            status: "not_found",
          });
          return;
        }

        const rawData = await env.PORTFOLIO_KV.get(key.name);
        if (!rawData) {
          result.chains.push({
            id: chainId,
            name: InchService.getChainName(chainId),
            status: "not_found",
          });
          return;
        }

        const parsedData = JSON.parse(rawData);
        if (parsedData.status !== "completed") {
          result.chains.push({
            id: chainId,
            name: InchService.getChainName(chainId),
            status: parsedData.status,
            error: parsedData.error,
          });
          return;
        }

        const data = parsedData.data as PortfolioResponse;
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
        logger.error(
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
