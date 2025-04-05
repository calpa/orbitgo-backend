import axios from "axios";
import { createContextLogger } from "../utils/logger";
import type { CreateWebhookRequest, WebhookResponse, Protocol, StoredWebhook, WebhookList } from "../types/webhook";
import { PROTOCOL_NETWORKS } from "../constants/networks";
import { Environment } from "../types/environment";

export class WebhookService {
  private readonly logger = createContextLogger(
    "/src/services/webhookService.ts",
    "WebhookService"
  );
  private readonly baseUrl = "https://web3.nodit.io/v1";
  private readonly apiKey: string;
  private readonly env: Environment;

  constructor(apiKey: string, env: Environment) {
    this.apiKey = apiKey;
    this.env = env;
  }

  private async storeWebhook(webhook: WebhookResponse, addresses: string[]): Promise<void> {
    const storedWebhook: StoredWebhook = {
      ...webhook,
      addresses
    };

    try {
      const existingData = await this.env.NODIT_WEBHOOK.get('webhooks');
      const webhookList: WebhookList = existingData ? 
        JSON.parse(existingData) : 
        { webhooks: [], lastUpdated: new Date().toISOString() };

      webhookList.webhooks.push(storedWebhook);
      webhookList.lastUpdated = new Date().toISOString();

      await this.env.NODIT_WEBHOOK.put('webhooks', JSON.stringify(webhookList));

      this.logger.info(
        { subscriptionId: webhook.subscriptionId },
        'Stored webhook in KV'
      );
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : 'Unknown error' },
        'Failed to store webhook in KV'
      );
      throw error;
    }
  }

  async getStoredWebhooks(): Promise<WebhookList> {
    try {
      const data = await this.env.NODIT_WEBHOOK.get('webhooks');
      if (!data) {
        return { webhooks: [], lastUpdated: new Date().toISOString() };
      }
      return JSON.parse(data);
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : 'Unknown error' },
        'Failed to get webhooks from KV'
      );
      throw error;
    }
  }

  async deleteStoredWebhook(subscriptionId: string): Promise<void> {
    try {
      const webhookList = await this.getStoredWebhooks();
      webhookList.webhooks = webhookList.webhooks.filter(
        webhook => webhook.subscriptionId !== subscriptionId
      );
      webhookList.lastUpdated = new Date().toISOString();

      await this.env.NODIT_WEBHOOK.put('webhooks', JSON.stringify(webhookList));

      this.logger.info(
        { subscriptionId },
        'Deleted webhook from KV'
      );
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : 'Unknown error' },
        'Failed to delete webhook from KV'
      );
      throw error;
    }
  }

  async createWebhooksForAllChains(
    addresses: string[],
    webhookUrl: string
  ): Promise<WebhookResponse[]> {
    const protocols = Object.keys(PROTOCOL_NETWORKS) as Protocol[];
    const responses: WebhookResponse[] = [];

    for (const protocol of protocols) {
      const networks = PROTOCOL_NETWORKS[protocol as keyof typeof PROTOCOL_NETWORKS];
      for (const network of networks) {
        try {
          const response = await this.createWebhook(protocol as Protocol, network, {
            protocol,
            network,
            eventType: 'SUCCESSFUL_TRANSACTION',
            description: `Monitor successful transactions for ${addresses.join(', ')} on ${protocol}/${network}`,
            notification: {
              webhookUrl
            },
            condition: {
              addresses
            }
          });
          await this.storeWebhook(response, addresses);
          responses.push(response);
          this.logger.info(
            { protocol, network, subscriptionId: response.subscriptionId },
            'Created webhook for chain'
          );
        } catch (error) {
          this.logger.error(
            { error: error instanceof Error ? error.message : 'Unknown error', protocol, network },
            'Failed to create webhook for chain'
          );
        }
      }
    }

    return responses;
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
