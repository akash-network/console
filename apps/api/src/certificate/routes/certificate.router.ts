import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER_OR_API_KEY } from "@src/core/services/openapi-docs/openapi-security";
import { CertificateController } from "../controllers/certificate.controller";
import { CreateCertificateResponseSchema } from "../http-schemas/create-certificate.schema";

export const certificateRouter = new OpenApiHonoHandler();

const createCertificateRoute = createRoute({
  method: "post",
  path: "/v1/certificates",
  summary: "Create certificate",
  tags: ["Certificate"],
  security: SECURITY_BEARER_OR_API_KEY,
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
certificateRouter.openapi(createCertificateRoute, async function routeCreateCertificate(c) {
  const result = await container.resolve(CertificateController).create();
  return c.json(result, 200);
});
