import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { container } from "tsyringe";

import { AdminUserRepository } from "@src/user/repositories/admin-user.repository";

const userSchema = z.object({
  id: z.string(),
  userId: z.string().nullable(),
  username: z.string().nullable(),
  email: z.string().nullable(),
  emailVerified: z.boolean(),
  stripeCustomerId: z.string().nullable(),
  lastActiveAt: z.string().nullable(),
  createdAt: z.string().nullable(),
  walletAddress: z.string().nullable(),
  isTrialing: z.boolean().nullable(),
  deploymentAllowance: z.string().nullable(),
  feeAllowance: z.string().nullable()
});

const searchUsersResponseSchema = z.object({
  data: z.object({
    users: z.array(userSchema),
    total: z.number(),
    page: z.number(),
    pageSize: z.number()
  })
});

const route = createRoute({
  method: "get",
  path: "/v1/admin/users/search",
  tags: ["Admin Users"],
  summary: "Search users",
  description: "Search users by email, username, user ID, or wallet address",
  request: {
    query: z.object({
      q: z.string().min(1).describe("Search query"),
      page: z.string().optional().default("1"),
      pageSize: z.string().optional().default("20")
    })
  },
  responses: {
    200: {
      description: "Search results",
      content: {
        "application/json": {
          schema: searchUsersResponseSchema
        }
      }
    }
  }
});

export const searchUsersRouter = new OpenAPIHono().openapi(route, async c => {
  const { q, page, pageSize } = c.req.valid("query");
  const repository = container.resolve(AdminUserRepository);

  const result = await repository.searchUsers(q, parseInt(page), parseInt(pageSize));

  return c.json({
    data: {
      users: result.users.map(u => ({
        ...u,
        lastActiveAt: u.lastActiveAt?.toISOString() ?? null,
        createdAt: u.createdAt?.toISOString() ?? null
      })),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize
    }
  });
});
