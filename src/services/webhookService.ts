import axios from "axios";
import { createContextLogger } from "../utils/logger";
import type { CreateWebhookRequest, WebhookResponse } from "../types/webhook";

export class WebhookService {
  private readonly logger = createContextLogger(
    "/src/services/webhookService.ts",
    "WebhookService"
  );
  private readonly baseUrl = "https://web3.nodit.io/v1";
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async createWebhook(
    protocol: string = "ethereum",
    network: string = "mainnet",
    request: CreateWebhookRequest
  ): Promise<WebhookResponse> {
    this.logger.debug({ protocol, network, request }, "Creating webhook");

    try {
      const response = await axios.post<WebhookResponse>(
        `${this.baseUrl}/${protocol}/${network}/webhooks`,
        {
          eventType: request.eventType || "SUCCESSFUL_TRANSACTION",
          description:
            request.description ||
            `Webhook for ${request.eventType || "successful transaction"}`,
          notification: request.notification,
          condition: request.condition,
        },
        {
          headers: {
            "X-API-KEY": this.apiKey,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        }
      );

      this.logger.info(
        { subscriptionId: response.data.subscriptionId },
        "Webhook created successfully"
      );

      return response.data;
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : "Unknown error" },
        "Failed to create webhook"
      );
      throw error;
    }
  }

  async deleteWebhook(
    protocol: string,
    network: string,
    subscriptionId: string
  ): Promise<void> {
    this.logger.debug(
      { protocol, network, subscriptionId },
      "Deleting webhook"
    );

    try {
      await axios.delete(
        `${this.baseUrl}/${protocol}/${network}/webhooks/${subscriptionId}`,
        {
          headers: {
            "X-API-KEY": this.apiKey,
            Accept: "application/json",
          },
        }
      );

      this.logger.info({ subscriptionId }, "Webhook deleted successfully");
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : "Unknown error" },
        "Failed to delete webhook"
      );
      throw error;
    }
  }
}
