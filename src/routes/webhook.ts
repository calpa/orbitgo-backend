import { Hono } from "hono";
import axios from "axios";
import { createContextLogger } from "../utils/logger";
import { WebhookService } from "../services/webhookService";
import { Environment } from "../types/environment";
import {
  createWebhookRequestSchema,
  protocolSchema,
  networkSchema,
} from "../types/webhook";
import { z } from "zod";

const createAllChainsWebhookSchema = z.object({
  addresses: z.array(z.string().regex(/^0x[a-fA-F0-9]{40}$/)),
  webhookUrl: z.string().url(),
});

const webhook = new Hono<{ Bindings: Environment }>();

/**
 * Create webhook subscriptions for all supported chains
 * @route POST /
 * @example
 * JSON input:
 * {
 *   "addresses": ["0x1234567890123456789012345678901234567890"],
 *   "webhookUrl": "https://example.com/webhook"
 * }
 */
webhook.post("/", async (c) => {
  const routeLogger = createContextLogger(
    "webhook.ts",
    "webhook.createForAddress"
  );
  const webhookService = new WebhookService(c.env.NODIT_API_KEY, c.env);

  try {
    const { addresses, webhookUrl } = createAllChainsWebhookSchema.parse(
      await c.req.json()
    );

    routeLogger.debug(
      { addresses },
      "Creating webhooks for address on all chains"
    );

    const responses = await webhookService.createWebhooksForAllChains(
      addresses,
      webhookUrl
    );

    routeLogger.info(
      { addresses, count: responses.length },
      "Successfully created webhooks for address on all chains"
    );

    return c.json(
      {
        message: "Successfully created webhooks for address on all chains",
        subscriptions: responses,
      },
      201
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      routeLogger.error(
        { error: error.errors },
        "Invalid webhook request data"
      );
      return c.json(
        {
          code: "INVALID_REQUEST",
          message: "Invalid request data",
          errors: error.errors,
        },
        400
      );
    }

    if (axios.isAxiosError(error)) {
      const status = error.response?.status || 500;
      const data = error.response?.data || {
        code: "UNKNOWN_ERROR",
        message: "An unknown error occurred",
      };

      routeLogger.error({ error: data, status }, "Failed to create webhooks");

      return c.json(data, status as 400 | 401 | 403 | 404 | 429 | 500);
    }

    routeLogger.error(
      { error: error instanceof Error ? error.message : "Unknown error" },
      "Failed to create webhooks"
    );

    return c.json(
      {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create webhooks",
      },
      500
    );
  }
});

/**
 * Create a new webhook subscription
 * @route POST /:protocol/:network/webhooks
 * @param protocol - The protocol to create the webhook for
 * @param network - The network to create the webhook for
 * @example
 * JSON input:
 * {
 *   "eventType": "SUCCESSFUL_TRANSACTION",
 *   "description": "Monitor successful transactions",
 *   "notification": {
 *     "webhookUrl": "https://example.com/webhook"
 *   },
 *   "condition": {
 *     "addresses": ["0x1234567890123456789012345678901234567890"]
 *   }
 * }
 *
 */
webhook.post("/:protocol/:network/webhooks", async (c) => {
  const routeLogger = createContextLogger("webhook.ts", "webhook.create");
  const webhookService = new WebhookService(c.env.NODIT_API_KEY, c.env);

  try {
    const protocol = protocolSchema.parse(c.req.param("protocol"));
    const network = networkSchema.parse(c.req.param("network"));
    const rawRequest = await c.req.json();

    const request = createWebhookRequestSchema.parse({
      ...rawRequest,
      protocol,
      network,
    });

    routeLogger.debug(
      { protocol, network, request },
      "Creating webhook subscription"
    );

    const webhook = await webhookService.createWebhook(
      protocol,
      network,
      request
    );

    routeLogger.info(
      { subscriptionId: webhook.subscriptionId },
      "Webhook created successfully"
    );

    return c.json(webhook, 201);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      routeLogger.error(
        { error: error.errors },
        "Invalid webhook request data"
      );
      return c.json(
        {
          code: "INVALID_REQUEST",
          message: "Invalid request data",
          errors: error.errors,
        },
        400
      );
    }

    if (axios.isAxiosError(error)) {
      const status = error.response?.status || 500;
      const data = error.response?.data || {
        code: "UNKNOWN_ERROR",
        message: "An unknown error occurred",
      };

      routeLogger.error({ error: data, status }, "Failed to create webhook");

      return c.json(data, status as 400 | 401 | 403 | 404 | 429 | 500);
    }

    routeLogger.error(
      { error: error instanceof Error ? error.message : "Unknown error" },
      "Failed to create webhook"
    );

    return c.json(
      {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create webhook",
      },
      500
    );
  }
});

/**
 * Delete a webhook subscription
 * @route DELETE /:protocol/:network/webhooks/:subscriptionId
 */
webhook.delete("/:protocol/:network/webhooks/:subscriptionId", async (c) => {
  const routeLogger = createContextLogger("webhook.ts", "webhook.delete");
  const webhookService = new WebhookService(c.env.NODIT_API_KEY, c.env);

  try {
    const protocol = protocolSchema.parse(c.req.param("protocol"));
    const network = networkSchema.parse(c.req.param("network"));
    const subscriptionId = z
      .string()
      .uuid()
      .parse(c.req.param("subscriptionId"));

    routeLogger.debug(
      { protocol, network, subscriptionId },
      "Deleting webhook subscription"
    );

    await webhookService.deleteWebhook(protocol, network, subscriptionId);

    routeLogger.info({ subscriptionId }, "Webhook deleted successfully");

    return c.json({ message: "Webhook deleted successfully" });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      routeLogger.error(
        { error: error.errors },
        "Invalid webhook request data"
      );
      return c.json(
        {
          code: "INVALID_REQUEST",
          message: "Invalid request data",
          errors: error.errors,
        },
        400
      );
    }

    if (axios.isAxiosError(error)) {
      const status = error.response?.status || 500;
      const data = error.response?.data || {
        code: "UNKNOWN_ERROR",
        message: "An unknown error occurred",
      };

      routeLogger.error({ error: data, status }, "Failed to delete webhook");

      return c.json(data, status as 400 | 401 | 403 | 404 | 429 | 500);
    }

    routeLogger.error(
      { error: error instanceof Error ? error.message : "Unknown error" },
      "Failed to delete webhook"
    );

    return c.json(
      {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to delete webhook",
      },
      500
    );
  }
});

/**
 * Get all stored webhook subscriptions
 * @route GET /webhooks?address={address}
 * @param address - The address to filter webhooks by
 * @example
 * GET /webhooks?address=0x1234567890123456789012345678901234567890
 */
webhook.get("/webhooks", async (c) => {
  const routeLogger = createContextLogger("webhook.ts", "webhook.list");
  const webhookService = new WebhookService(c.env.NODIT_API_KEY, c.env);

  try {
    const address = c.req.query("address");
    if (!address) {
      return c.json(
        {
          code: "INVALID_REQUEST",
          message: "Missing required parameter: address",
        },
        400
      );
    }
    const webhooks = await webhookService.getStoredWebhooks();
    const filteredWebhooks = webhooks.webhooks.filter((webhook) =>
      webhook.addresses.includes(address)
    );

    routeLogger.info(
      { count: filteredWebhooks.length },
      "Retrieved stored webhooks"
    );

    return c.json(filteredWebhooks);
  } catch (error) {
    routeLogger.error(
      { error: error instanceof Error ? error.message : "Unknown error" },
      "Failed to get stored webhooks"
    );

    return c.json(
      {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to get stored webhooks",
      },
      500
    );
  }
});

export { webhook };
