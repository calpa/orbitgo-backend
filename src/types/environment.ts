import { Queue, KVNamespace } from "@cloudflare/workers-types";
import { PortfolioQueueMessage } from "./inch";

export interface Environment {
  INCH_API_KEY: string;
  NODIT_API_KEY: string;
  PORTFOLIO_KV: KVNamespace;
  NODIT_WEBHOOK: KVNamespace;
  portfolio_queue: Queue<PortfolioQueueMessage>;
};
