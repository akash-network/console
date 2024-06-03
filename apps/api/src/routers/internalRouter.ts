import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";

import { env } from "@src/utils/env";
import routes from "../routes/internal";

export const internalRouter = new OpenAPIHono();

internalRouter.doc(`/doc`, {
  openapi: "3.0.0",
  servers: [{ url: `${env.ServerOrigin}/internal` }],
  info: {
    title: "Cloudmos Internal API",
    description: "APIs for internal use that are not part of the public API. There is no garantees of stability or backward compatibility.",
    version: "test"
  }
});

const swaggerInstance = swaggerUI({ url: `/internal/doc` });

internalRouter.get(`/swagger`, swaggerInstance);

routes.forEach((route) => internalRouter.route(`/`, route));
