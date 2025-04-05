import { Protocol } from "../types/webhook";

export const SUPPORTED_PROTOCOLS: Protocol[] = [
  "arbitrum",
  "base", 
  "ethereum",
  "kaia",
  "optimism",
  "polygon",
  "luniverse",
  "aptos"
];

export function isSupportedProtocol(protocol: string): protocol is Protocol {
  return SUPPORTED_PROTOCOLS.includes(protocol as Protocol);
}
