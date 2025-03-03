import { createRoute } from "@hono/zod-openapi";
import { container } from "tsyringe";

import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { CertificateController } from "../controllers/certificate.controller";
import { CreateCertificateResponseSchema } from "../http-schemas/create-certificate.schema";

const createCertificateRoute = createRoute({
  method: "post",
  path: "/v1/certificates",
  summary: "Create certificate",
  tags: ["Certificate"],
  responses: {
    200: {
      description: "Certificate created",
      content: {
        "application/json": {
          schema: CreateCertificateResponseSchema
        }
      }
    }
  }
});

export const certificateRouter = new OpenApiHonoHandler();

certificateRouter.openapi(createCertificateRoute, async function routeCreateCertificate(c) {
  const result = await container.resolve(CertificateController).create();
  return c.json(result, 200);
});
