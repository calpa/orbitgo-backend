export interface Chain {
  id: number;
  name: string;
  icon: string;
}

export interface SupportedChains {
  result: Chain[];
}

export interface PortfolioQueueMessage {
  chainId: number;
  address: `0x${string}`;
  requestId: string;
  timestamp: number;
}

export interface UnderlyingToken {
  chain_id: number;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  amount: number;
  price_to_usd: number;
  value_usd: number;
}

export interface PositionInfo {
  address: number;
  shares: number;
  amount: number;
  tokens_amounts: number[];
  tokens_addresses: number[];
  value_inflow_usd_period: number;
  value_outflow_usd_period: number;
  value_usd_end: number;
  value_usd_start: number;
  abs_profit_usd: number;
  roi: number;
  holding_time_days: number;
  fees: number;
  share: number;
  reserves: number[];
  total_supply: number;
}

export interface PortfolioPosition {
  chain_id: number;
  contract_address: string;
  token_id: number;
  addresses: string[];
  protocol: string;
  name: string;
  contract_type: string;
  sub_contract_type: string;
  is_whitelisted: number;
  protocol_name: string;
  protocol_icon: string | null;
  status: number;
  token_address: string;
  underlying_tokens: UnderlyingToken[];
  value_usd: number;
  debt: boolean;
  rewards_tokens: UnderlyingToken[];
  profit_abs_usd: number | null;
  roi: number | null;
  weighted_apr: number | null;
  holding_time_days: number;
  info: PositionInfo;
}

export interface PortfolioResponse {
  result: PortfolioPosition[];
}

export interface QueuedRequest {
  chainId: number;
  address: `0x${string}`;
  requestId: string;
  retryCount: number;
  timestamp: number;
}

export interface PortfolioStatus {
  status: 'queued' | 'completed' | 'failed';
  data?: PortfolioResponse;
  error?: string;
  position?: number;
  timestamp?: number;
}

export interface ValueChartItem {
  timestamp: number;
  value_usd: number;
}

export interface ValueChartResponse {
  result: ValueChartItem[];
  meta?: {
    cached_at?: number;
    system?: {
      total_time: number;
    };
  };
}

export type TimeRange = '1day' | '1week' | '1month' | '1year' | 'all';

export type TokenAction = {
  chainId: string;
  address: string;
  standard: 'Native' | 'ERC20' | 'ERC721' | 'ERC1155';
  fromAddress: string;
  toAddress: string;
  tokenId?: string;
  amount?: string;
  direction: 'In' | 'Out' | 'Self' | 'On';
  priceToUsd?: number;
};

export type TransactionDetails = {
  orderInBlock: number;
  txHash: string;
  chainId: number;
  blockNumber: number;
  blockTimeSec: number;
  status: string;
  type: string;
  tokenActions: TokenAction[];
  fromAddress: string;
  toAddress: string;
  nonce: number;
  feeInSmallestNative: string;
  nativeTokenPriceToUsd: number | null;
  meta?: {
    protocol?: string;
  };
};

export type HistoryEvent = {
  timeMs: number;
  address: string;
  type: number;
  rating: 'Reliable' | 'Scam';
  direction: 'in' | 'out';
  details: TransactionDetails;
  id: string;
  eventOrderInTransaction: number;
};

export type HistoryResponse = {
  items: HistoryEvent[];
};
