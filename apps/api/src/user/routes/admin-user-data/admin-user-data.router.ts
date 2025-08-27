import { createRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";
import { z } from "zod";

import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { UserController } from "@src/user/controllers/user/user.controller";

const adminUserDataQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  sortBy: z.enum(["totalSpend", "createdAt", "lastActiveAt"]).optional().default("totalSpend"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc")
});

const adminUserDataResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      userId: z.string().nullable(),
      email: z.string().nullable(),
      walletAddress: z.string().nullable(),
      totalSpend: z.number(),
      totalCreditPurchases: z.number(),
      couponsClaimed: z.number(),
      activeLeasesCount: z.number(),
      totalAktSpent: z.number(),
      totalUsdcSpent: z.number(),
      totalUsdSpent: z.number(),
      createdAt: z.date().nullable(),
      lastActiveAt: z.date().nullable()
    })
  ),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number()
  })
});

const route = createRoute({
  method: "get",
  path: "/v1/user-data",
  summary: "Retrieve all users with wallet spending and general status (Admin only)",
  tags: ["Users"],
  security: [{ bearerAuth: [] }],
  request: {
    query: adminUserDataQuerySchema
  },
  responses: {
    200: {
      description:
        "Returns paginated user data with wallet spending and status information. Note: Sorting is applied to paginated results only for performance.",
      content: {
        "application/json": {
          schema: adminUserDataResponseSchema
        }
      }
    },
    401: {
      description: "Unauthorized - User not authenticated"
    },
    403: {
      description: "Forbidden - User does not have admin privileges"
    }
  }
});

export const adminUserDataRouter = new OpenApiHonoHandler().openapi(route, async function getAdminUserData(c) {
  const query = c.req.valid("query");
  const result = await container.resolve(UserController).getAdminUserData(query);
  return c.json(result, 200);
});
