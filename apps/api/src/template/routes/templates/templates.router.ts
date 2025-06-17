import { createRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";

import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { TemplateController } from "@src/template/controllers/template/template.controller";
import {
  GetTemplateByIdParamsSchema,
  GetTemplateByIdResponseSchema,
  GetTemplatesFullResponseSchema,
  GetTemplatesListResponseSchema
} from "@src/template/http-schemas/template.schema";

export const templatesRouter = new OpenApiHonoHandler();

const getTemplatesFullRoute = createRoute({
  method: "get",
  path: "/v1/templates",
  tags: ["Other"],
  responses: {
    200: {
      description: "Returns a list of deployment templates grouped by categories",
      content: {
        "application/json": {
          schema: GetTemplatesFullResponseSchema
        }
      }
    }
  }
});
templatesRouter.openapi(getTemplatesFullRoute, async function routeGetTemplatesFullList(c) {
  const result = await container.resolve(TemplateController).getTemplatesFull();

  return c.json(result, 200);
});

const getTemplatesListRoute = createRoute({
  method: "get",
  path: "/v1/templates-list",
  tags: ["Other"],
  responses: {
    200: {
      description: "Returns a list of deployment templates grouped by categories",
      content: {
        "application/json": {
          schema: GetTemplatesListResponseSchema
        }
      }
    }
  }
});
templatesRouter.openapi(getTemplatesListRoute, async function routeGetTemplatesList(c) {
  const result = await container.resolve(TemplateController).getTemplatesList();

  return c.json(result, 200);
});

const getTemplateByIdRoute = createRoute({
  method: "get",
  path: "/v1/templates/{id}",
  tags: ["Other"],
  request: {
    params: GetTemplateByIdParamsSchema
  },
  responses: {
    200: {
      description: "Return a template by id",
      content: {
        "application/json": {
          schema: GetTemplateByIdResponseSchema
        }
      }
    },
    404: {
      description: "Template not found"
    }
  }
});
templatesRouter.openapi(getTemplateByIdRoute, async function routeGetTemplateById(c) {
  const { id } = c.req.valid("param");
  const result = await container.resolve(TemplateController).getTemplateById(id);

  return c.json(result, 200);
});
