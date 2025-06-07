import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import type { Context, Env } from "hono";
import { container } from "tsyringe";

import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import type { AppEnv } from "@src/core/types/app-context";
import { LeasesDurationController } from "@src/dashboard/controllers/leases-duration/leases-duration.controller";
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

const leasesDurationHandler = async <Env>(
  c: Context<
    Env,
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
  const { owner } = c.req.valid("param");
  const query = c.req.valid("query");

  const leasesDuration = await container.resolve(LeasesDurationController).getLeasesDuration(owner, query);

  return c.json(leasesDuration);
};

export const leasesDurationRouter = new OpenApiHonoHandler();
leasesDurationRouter.openapi(route, leasesDurationHandler<AppEnv>);

export const leasesDurationInternalRouter = new OpenAPIHono().openapi(route, leasesDurationHandler<Env>);
