import { OpenAPIHono } from "@hono/zod-openapi";
import type { Context, Env } from "hono";
import { container } from "tsyringe";

import { createRoute } from "@src/core/services/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_NONE } from "@src/core/services/openapi-docs/openapi-security";
import type { AppEnv } from "@src/core/types/app-context";
import { LeasesDurationController } from "@src/dashboard/controllers/leases-duration/leases-duration.controller";
import type { LeasesDurationParams, LeasesDurationQuery } from "@src/dashboard/http-schemas/leases-duration/leases-duration.schema";
import {
  LeasesDurationParamsSchema,
  LeasesDurationQuerySchema,
  LeasesDurationResponseSchema
} from "@src/dashboard/http-schemas/leases-duration/leases-duration.schema";

export const route = createRoute({
  method: "get",
  path: "/v1/leases-duration/{owner}",
  summary: "Get leases durations.",
  tags: ["Analytics"],
  security: SECURITY_NONE,
  request: {
    params: LeasesDurationParamsSchema,
    query: LeasesDurationQuerySchema
  },
  responses: {
    200: {
      description: "List of leases durations and total duration.",
      content: {
        "application/json": {
          schema: LeasesDurationResponseSchema
        }
      }
    },
    400: {
      description: "Invalid start date, must be in the following format: YYYY-MM-DD"
    }
  }
});

const leasesDurationHandler = async <E extends Env>(
  c: Context<
    E,
    "/v1/leases-duration/:owner",
    {
      in: {
        param: {
          owner?: string;
        };
      };
      out: {
        param: {
          owner?: string;
        };
      };
    } & {
      in: {
        query: {
          dseq?: string;
          startDate?: Date;
          endDate?: Date;
        };
      };
      out: {
        query: {
          dseq?: string;
          startDate?: Date;
          endDate?: Date;
        };
      };
    }
  >
) => {
  const { owner } = c.req.valid("param") as LeasesDurationParams;
  const query = c.req.valid("query") as LeasesDurationQuery;

  const leasesDuration = await container.resolve(LeasesDurationController).getLeasesDuration(owner, query);

  return c.json(leasesDuration);
};

export const leasesDurationRouter = new OpenApiHonoHandler();
leasesDurationRouter.openapi(route, leasesDurationHandler<AppEnv>);

export const leasesDurationInternalRouter = new OpenAPIHono().openapi(route, leasesDurationHandler<Env>);
