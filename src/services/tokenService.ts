import axios from "axios";
import { createContextLogger } from "../utils/logger";
import type { Protocol } from "../types/webhook";
import type { GetTokensOwnedRequest, GetTokensOwnedResponse } from "../types/token";

export class TokenService {
  private readonly logger = createContextLogger(
    "/src/services/tokenService.ts",
    "TokenService"
  );
  private readonly baseUrl = "https://web3.nodit.io/v1";
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async getTokensOwnedByAccount(
    protocol: Protocol,
    network: string,
    request: GetTokensOwnedRequest
  ): Promise<GetTokensOwnedResponse> {
    try {
      const response = await axios.post<GetTokensOwnedResponse>(
        `${this.baseUrl}/${protocol}/${network}/token/getTokensOwnedByAccount`,
        request,
        {
          headers: {
            "X-API-KEY": this.apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      this.logger.info(
        { protocol, network, accountAddress: request.accountAddress },
        "Retrieved tokens owned by account"
      );

      return response.data;
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : "Unknown error",
          protocol,
          network,
          accountAddress: request.accountAddress,
        },
        "Failed to get tokens owned by account"
      );
      throw error;
    }
  }
}
