import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
import { container } from "tsyringe";

import { stripHiddenOperations } from "@src/core/lib/create-route/create-route";
import { CORE_CONFIG } from "@src/core/providers/config.provider";
import { requirePrivateToken } from "@src/middlewares/privateMiddleware";
import routes, { internalOpenApiHonoHandlers } from "../routes/internal";

export const internalRouter = new OpenAPIHono();

/** Served by hand rather than by `internalRouter.doc`, because that helper publishes every operation including the ones flagged `hiddenInOpenApiDocs`. */
internalRouter.get(`/doc`, c => {
  const document = internalRouter.getOpenAPIDocument({
    openapi: "3.0.0",
    servers: [{ url: `${container.resolve(CORE_CONFIG).SERVER_ORIGIN}/internal` }],
    info: {
      title: "Console Internal API",
      description: "APIs for internal use that are not part of the public API. There is no garantees of stability or backward compatibility.",
      version: "test"
    }
  });

  return c.json({ ...document, paths: stripHiddenOperations(document.paths) });
});

const swaggerInstance = swaggerUI({ url: `/internal/doc` });

internalRouter.get(`/swagger`, swaggerInstance);

internalRouter.use("/financial", requirePrivateToken);

routes.forEach(route => internalRouter.route(`/`, route));
internalOpenApiHonoHandlers.forEach(handler => internalRouter.route(`/`, handler));
