import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";

import { env } from "@src/utils/env";
import routesV1 from "../routes/v1";

export const apiRouter = new OpenAPIHono();

function registerApiVersion(version: string, baseRouter: OpenAPIHono, versionRoutes: OpenAPIHono[]) {
  const versionRouter = new OpenAPIHono();

  versionRouter.doc(`/doc`, {
    openapi: "3.0.0",
    servers: [{ url: `${env.SERVER_ORIGIN}/${version}` }],
    info: {
      title: "Console API",
      description: "Access Akash data from our indexer",
      version: version
    }
  });
  const swaggerInstance = swaggerUI({ url: `/${version}/doc` });

  versionRouter.get(`/swagger`, swaggerInstance);
  versionRouter.get(`/swagger/`, c => c.redirect(`/${version}/swagger`));

  versionRoutes.forEach(route => versionRouter.route(`/`, route));
  baseRouter.route(`/${version}`, versionRouter);
}

registerApiVersion("v1", apiRouter, routesV1);
