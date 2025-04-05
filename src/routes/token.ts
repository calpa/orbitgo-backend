import { Hono } from "hono";
import { TokenService } from "../services/tokenService";
import { createContextLogger } from "../utils/logger";
import { Environment } from "../types/environment";
import { protocolSchema, networkSchema } from "../types/webhook";
import { getTokensOwnedRequestSchema } from "../types/token";
import { z } from "zod";
import axios from "axios";

const token = new Hono<{ Bindings: Environment }>();

/**
 * Get tokens owned by an account
 * @route POST /:protocol/:network/tokens/owned
 * @param protocol - The protocol to query (e.g., ethereum)
 * @param network - The network to query (e.g., mainnet)
 * @example
 * Request body:
 * {
 *   "accountAddress": "0x1234...",
 *   "contractAddresses": ["0x1234..."], // optional
 *   "page": 1, // optional
 *   "rpp": 20, // optional
 *   "cursor": "abc...", // optional
 *   "withCount": false // optional
 * }
 */
token.post("/:protocol/:network/tokens/owned", async (c) => {
  const routeLogger = createContextLogger("token.ts", "token.getOwned");
  const tokenService = new TokenService(c.env.NODIT_API_KEY);

  try {
    const protocol = protocolSchema.parse(c.req.param("protocol"));
    const network = networkSchema.parse(c.req.param("network"));
    const request = getTokensOwnedRequestSchema.parse(await c.req.json());

    routeLogger.debug(
      { protocol, network, accountAddress: request.accountAddress },
      "Getting tokens owned by account"
    );

    const response = await tokenService.getTokensOwnedByAccount(
      protocol,
      network,
      request
    );

    routeLogger.info(
      {
        protocol,
        network,
        accountAddress: request.accountAddress,
        count: response.items.length,
      },
      "Successfully retrieved tokens"
    );

    return c.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      routeLogger.error(
        { error: error.errors },
        "Invalid request data"
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

      routeLogger.error(
        { error: data, status },
        "Failed to get tokens"
      );

      return c.json(data, status as 400 | 401 | 403 | 404 | 429 | 500);
    }

    routeLogger.error(
      { error: error instanceof Error ? error.message : "Unknown error" },
      "Failed to get tokens"
    );

    return c.json(
      {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to get tokens",
      },
      500
    );
  }
});

export { token };
