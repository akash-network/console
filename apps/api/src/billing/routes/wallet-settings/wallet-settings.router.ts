import { container } from "tsyringe";

import { WalletSettingController } from "@src/billing/controllers/wallet-settings/wallet-settings.controller";
import { CreateWalletSettingsRequestSchema, UpdateWalletSettingsRequestSchema, WalletSettingsResponseSchema } from "@src/billing/http-schemas/wallet.schema";
import { createRoute } from "@src/core/services/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER_OR_API_KEY } from "@src/core/services/openapi-docs/openapi-security";

export const walletSettingRouter = new OpenApiHonoHandler();

const getWalletSettingsRoute = createRoute({
  method: "get",
  path: "/v1/wallet-settings",
  summary: "Get wallet settings",
  description: "Retrieves the wallet settings for the current user's wallet",
  tags: ["WalletSetting"],
  security: SECURITY_BEARER_OR_API_KEY,
  request: {},
  responses: {
    200: {
      description: "Wallet settings retrieved successfully",
      content: {
        "application/json": {
          schema: WalletSettingsResponseSchema
        }
      }
    },
    404: {
      description: "UserWallet Not Found"
    }
  }
});
walletSettingRouter.openapi(getWalletSettingsRoute, async function getWalletSettings(c) {
  return c.json(await container.resolve(WalletSettingController).getWalletSettings(), 200);
});

const createWalletSettingsRoute = createRoute({
  method: "post",
  path: "/v1/wallet-settings",
  summary: "Create wallet settings",
  description: "Creates wallet settings for a user wallet",
  tags: ["WalletSetting"],
  security: SECURITY_BEARER_OR_API_KEY,
  request: {
    body: {
      content: {
        "application/json": {
          schema: CreateWalletSettingsRequestSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: "Wallet settings created successfully",
      content: {
        "application/json": {
          schema: WalletSettingsResponseSchema
        }
      }
    },
    404: {
      description: "UserWallet Not Found"
    }
  }
});
walletSettingRouter.openapi(createWalletSettingsRoute, async function createWalletSettings(c) {
  return c.json(await container.resolve(WalletSettingController).createWalletSettings(c.req.valid("json")), 200);
});

const updateWalletSettingsRoute = createRoute({
  method: "put",
  path: "/v1/wallet-settings",
  summary: "Update wallet settings",
  description: "Updates wallet settings for a user wallet",
  tags: ["WalletSetting"],
  security: SECURITY_BEARER_OR_API_KEY,
  request: {
    body: {
      content: {
        "application/json": {
          schema: UpdateWalletSettingsRequestSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: "Wallet settings updated successfully",
      content: {
        "application/json": {
          schema: WalletSettingsResponseSchema
        }
      }
    },
    404: {
      description: "UserWallet Not Found"
    }
  }
});
walletSettingRouter.openapi(updateWalletSettingsRoute, async function updateWalletSettings(c) {
  return c.json(await container.resolve(WalletSettingController).updateWalletSettings(c.req.valid("json")), 200);
});

const deleteWalletSettingsRoute = createRoute({
  method: "delete",
  path: "/v1/wallet-settings",
  summary: "Delete wallet settings",
  description: "Deletes wallet settings for a user wallet",
  tags: ["WalletSetting"],
  security: SECURITY_BEARER_OR_API_KEY,
  request: {},
  responses: {
    204: {
      description: "Wallet settings deleted successfully"
    },
    404: {
      description: "UserWallet Not Found"
    }
  }
});
walletSettingRouter.openapi(deleteWalletSettingsRoute, async function deleteWalletSettings(c) {
  await container.resolve(WalletSettingController).deleteWalletSettings();
  return c.body(null, 204);
});
