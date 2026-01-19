import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { container } from "tsyringe";

import { AdminUserRepository } from "@src/user/repositories/admin-user.repository";

const userStatsResponseSchema = z.object({
  data: z.object({
    totalUsers: z.number(),
    newUsersLast7Days: z.number(),
    newUsersLast30Days: z.number(),
    activeUsersLast30Days: z.number()
  })
});

const route = createRoute({
  method: "get",
  path: "/v1/admin/analytics/users",
  tags: ["Admin Analytics"],
  summary: "Get user statistics",
  description: "Get overall user statistics including total users, new users, and active users",
  responses: {
    200: {
      description: "User statistics",
      content: {
        "application/json": {
          schema: userStatsResponseSchema
        }
      }
    }
  }
});

export const userStatsRouter = new OpenAPIHono().openapi(route, async c => {
  const repository = container.resolve(AdminUserRepository);
  const stats = await repository.getUserStats();

  return c.json({
    data: stats
  });
});
