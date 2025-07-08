import { OpenAPIHono } from "@hono/zod-openapi";

import routesV1 from "../routes/v1";

export const apiRouter = new OpenAPIHono();

function registerApiVersion(version: string, baseRouter: OpenAPIHono, versionRoutes: OpenAPIHono[]) {
  const versionRouter = new OpenAPIHono();

  versionRoutes.forEach(route => versionRouter.route(`/`, route));
  baseRouter.route(`/${version}`, versionRouter);
}

registerApiVersion("v1", apiRouter, routesV1);
