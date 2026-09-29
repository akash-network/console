import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER } from "@src/core/services/openapi-docs/openapi-security";
import { HardwareRequestController } from "../controllers/hardware-request/hardware-request.controller";
import { CreateHardwareRequestRequestSchema, CreateHardwareRequestResponseSchema } from "../http-schemas/hardware-request.schema";

export const hardwareRequestRouter = new OpenApiHonoHandler();

const createHardwareRequestRoute = createRoute({
  method: "post",
  operationId: "createHardwareRequest",
  path: "/v1/hardware-requests",
  summary: "Ask the Akash team for a GPU model, more capacity or a region that is not available yet",
  tags: ["Hardware Requests"],
  security: SECURITY_BEARER,
  bodyLimit: { maxSize: 16 * 1024 },
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: CreateHardwareRequestRequestSchema
        }
      }
    }
  },
  responses: {
    201: {
      description: "The request was recorded and the Akash team will follow up by email",
      content: {
        "application/json": {
          schema: CreateHardwareRequestResponseSchema
        }
      }
    },
    400: { description: "Invalid request body" },
    401: { description: "Unauthorized" },
    429: { description: "Too many requests sent recently" }
  }
});

hardwareRequestRouter.openapi(createHardwareRequestRoute, async function routeCreateHardwareRequest(c) {
  const { data } = c.req.valid("json");
  const result = await container.resolve(HardwareRequestController).create(data);
  return c.json(result, 201);
});
