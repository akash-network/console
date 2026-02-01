import { container } from "tsyringe";
import { z } from "zod";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER_OR_API_KEY, SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";
import { UserController } from "@src/user/controllers/user/user.controller";

export const userSettingsRouterV2 = new OpenApiHonoHandler();

// GET /byUsername/:username - optional auth
const getUserByUsernameRoute = createRoute({
  method: "get",
  path: "/user/byUsername/{username}",
  summary: "Get user by username",
  tags: ["Users"],
  security: SECURITY_NONE,
  request: {
    params: z.object({
      username: z.string()
    })
  },
  responses: {
    200: {
      description: "Returns user profile",
      content: {
        "application/json": {
          schema: z.object({
            username: z.string(),
            bio: z.string().nullable()
          })
        }
      }
    },
    404: {
      description: "User not found"
    }
  }
});

userSettingsRouterV2.openapi(getUserByUsernameRoute, async function getUserByUsername(c) {
  const { username } = c.req.valid("param");
  const user = await container.resolve(UserController).getUserByUsername(username);
  return c.json(user, 200);
});

// PUT /updateSettings - requires auth
const updateSettingsRoute = createRoute({
  method: "put",
  path: "/user/updateSettings",
  summary: "Update user settings",
  tags: ["Users"],
  security: SECURITY_BEARER_OR_API_KEY,
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            username: z.string(),
            subscribedToNewsletter: z.boolean(),
            bio: z.string(),
            youtubeUsername: z.string(),
            twitterUsername: z.string(),
            githubUsername: z.string()
          })
        }
      }
    }
  },
  responses: {
    200: {
      description: "Settings updated successfully"
    },
    400: {
      description: "Invalid input"
    },
    401: {
      description: "Unauthorized"
    }
  }
});

userSettingsRouterV2.openapi(updateSettingsRoute, async function updateSettings(c) {
  const data = c.req.valid("json");
  await container.resolve(UserController).updateSettings(data);
  return c.text("Saved", 200);
});

// GET /checkUsernameAvailability/:username
const checkUsernameAvailabilityRoute = createRoute({
  method: "get",
  path: "/user/checkUsernameAvailability/{username}",
  summary: "Check if username is available",
  tags: ["Users"],
  security: SECURITY_NONE,
  request: {
    params: z.object({
      username: z.string()
    })
  },
  responses: {
    200: {
      description: "Returns username availability",
      content: {
        "application/json": {
          schema: z.object({
            isAvailable: z.boolean()
          })
        }
      }
    }
  }
});

userSettingsRouterV2.openapi(checkUsernameAvailabilityRoute, async function checkUsernameAvailability(c) {
  const { username } = c.req.valid("param");
  const result = await container.resolve(UserController).checkUsernameAvailable(username);
  return c.json(result, 200);
});

// POST /subscribeToNewsletter - requires auth
const subscribeToNewsletterRoute = createRoute({
  method: "post",
  path: "/user/subscribeToNewsletter",
  summary: "Subscribe to newsletter",
  tags: ["Users"],
  security: SECURITY_BEARER_OR_API_KEY,
  responses: {
    200: {
      description: "Subscribed successfully"
    },
    401: {
      description: "Unauthorized"
    }
  }
});

userSettingsRouterV2.openapi(subscribeToNewsletterRoute, async function subscribeToNewsletter(c) {
  await container.resolve(UserController).subscribeToNewsletter();
  return c.text("Subscribed", 200);
});
