import { createContextLogger } from "../../utils/logger";
import { ValueChartResponse } from "../../types/inch";
import { TimeRange } from "../../types/inch";
import axios from "axios";

export async function getValueChart(
  env: any,
  context: string,
  address: `0x${string}`,
  chainId?: number,
  timerange: TimeRange = "1month",
  useCache: boolean = true
): Promise<ValueChartResponse> {
  const url = new URL(
    "https://api.1inch.dev/portfolio/portfolio/v4/general/value_chart"
  );
  url.searchParams.append("addresses", address);
  if (chainId) url.searchParams.append("chain_id", chainId.toString());
  url.searchParams.append("timerange", timerange);
  url.searchParams.append("use_cache", useCache.toString());

  const logger = createContextLogger("getValueChart", context);
  logger.info(
    { address, chainId, timerange, useCache },
    "Fetching value chart from 1inch API"
  );

  const response = await axios.get<ValueChartResponse>(url.toString(), {
    headers: {
      Authorization: `Bearer ${env.INCH_API_KEY}`,
      Accept: "application/json",
    },
  });

  logger.info(
    {
      address,
      chainId,
      dataPoints: response.data.result.length,
    },
    "Successfully fetched value chart data"
  );

  return response.data;
}
