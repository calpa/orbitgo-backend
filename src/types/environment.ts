import { Queue, KVNamespace } from "@cloudflare/workers-types";
import { PortfolioQueueMessage } from "./inch";

export type Environment = {
  INCH_API_KEY: string;
  PORTFOLIO_KV: KVNamespace;
  portfolio_queue: Queue<PortfolioQueueMessage>;
};
