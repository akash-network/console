import { createRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";
import { z } from "zod";

import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { JwtTokenController } from "@src/provider/controllers/jwt-token/jwt-token.controller";
import { CreateJwtTokenRequestSchema, CreateJwtTokenResponseSchema } from "@src/provider/http-schemas/jwt-token.schema";

export const providerJwtTokenRouter = new OpenApiHonoHandler();

providerJwtTokenRouter.openapi(
  createRoute({
    method: "post",
    path: "/v1/create-jwt-token",
    summary: "Create new JWT token for managed wallet",
    tags: ["JWT Token"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              data: CreateJwtTokenRequestSchema
            })
          }
        }
      }
    },
    responses: {
      201: {
        description: "JWT token created successfully",
        content: {
          "application/json": {
            schema: z.object({
              data: CreateJwtTokenResponseSchema
            })
          }
        }
      }
    }
  }),
  async function routeCreateJwtToken(c) {
    const body = c.req.valid("json");
    const result = await container.resolve(JwtTokenController).createJwtToken(body.data);
    return c.json({ data: result }, 201);
  }
);
