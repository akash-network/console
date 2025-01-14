import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";

import { privateMiddleware } from "@src/middlewares/privateMiddleware";
import { env } from "@src/utils/env";
import routes from "../routes/internal";

export const internalRouter = new OpenAPIHono();

internalRouter.doc(`/doc`, {
  openapi: "3.0.0",
  servers: [{ url: `${env.SERVER_ORIGIN}/internal` }],
  info: {
    title: "Console Internal API",
    description: "APIs for internal use that are not part of the public API. There is no garantees of stability or backward compatibility.",
    version: "test"
  }
});

const swaggerInstance = swaggerUI({ url: `/internal/doc` });

internalRouter.get(`/swagger`, swaggerInstance);

internalRouter.use("/financial", privateMiddleware);

routes.forEach(route => internalRouter.route(`/`, route));
