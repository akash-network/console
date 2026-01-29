import { OpenAPIHono, z } from "@hono/zod-openapi";
import assert from "http-assert";
import { container } from "tsyringe";

import { CloseBlockedUserDeployments } from "@src/app/services/close-blocked-user-deployments/close-blocked-user-deployments.handler";
import { JobQueueService } from "@src/core";
import { createRoute } from "@src/core/lib/create-route/create-route";
import { SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";
import { UserRepository } from "@src/user/repositories";

const userResponseSchema = z.object({
  id: z.string().uuid(),
  isBlocked: z.boolean()
});

const blockUserRoute = createRoute({
  method: "post",
  path: "/users/{userId}/block",
  summary: "Block a user",
  security: SECURITY_NONE,
  request: {
    params: z.object({
      userId: z.string().uuid()
    })
  },
  responses: {
    200: {
      description: "User blocked successfully",
      content: {
        "application/json": {
          schema: userResponseSchema
        }
      }
    },
    404: {
      description: "User not found"
    }
  }
});

const unblockUserRoute = createRoute({
  method: "post",
  path: "/users/{userId}/unblock",
  summary: "Unblock a user",
  security: SECURITY_NONE,
  request: {
    params: z.object({
      userId: z.string().uuid()
    })
  },
  responses: {
    200: {
      description: "User unblocked successfully",
      content: {
        "application/json": {
          schema: userResponseSchema
        }
      }
    },
    404: {
      description: "User not found"
    }
  }
});

export default new OpenAPIHono()
  .openapi(blockUserRoute, async c => {
    const { userId } = c.req.valid("param");
    const userRepository = container.resolve(UserRepository);
    const jobQueueService = container.resolve(JobQueueService);

    const user = await userRepository.blockUser(userId);
    assert(user, 404, "User not found");

    await jobQueueService.enqueue(new CloseBlockedUserDeployments({ userId }), {
      singletonKey: `closeBlockedUserDeployments.${userId}`
    });

    return c.json({ id: user.id, isBlocked: user.isBlocked });
  })
  .openapi(unblockUserRoute, async c => {
    const { userId } = c.req.valid("param");
    const userRepository = container.resolve(UserRepository);

    const user = await userRepository.unblockUser(userId);
    assert(user, 404, "User not found");

    return c.json({ id: user.id, isBlocked: user.isBlocked });
  });
