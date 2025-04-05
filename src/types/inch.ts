export interface Chain {
  id: number;
  name: string;
  icon: string;
}

export interface SupportedChains {
  result: Chain[];
}

export interface PortfolioResponse {
  // Add specific 1inch API response types here
  protocols: any[];
  // Add other fields as needed
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
