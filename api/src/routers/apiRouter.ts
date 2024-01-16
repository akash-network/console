import express from "express";
import { OpenAPIHono } from "@hono/zod-openapi";

import { swaggerUI } from "@hono/swagger-ui";
import routesV1 from "../routes/v1";

export const apiRouter = express.Router();

export const apiRouterHono = new OpenAPIHono();

function registerApiVersion(version: string, baseRouter: OpenAPIHono, versionRoutes: OpenAPIHono[]) {
  const versionRouter = new OpenAPIHono();
  versionRouter.doc(`/doc`, {
    openapi: "3.0.0",
    servers: [
      { url: `http://localhost:8787/api/${version}`, description: "Localhost" },
      { url: `https://api-preview.cloudmos.io/api/${version}`, description: "Online Preview" }
    ], // TODO
    info: {
      title: "Cloudmos API",
      description: "Access Akash data from our indexer",
      version: version
    }
  });
  const swaggerInstance = swaggerUI({ url: `/api/${version}/doc` });

  versionRouter.get(`/swagger`, swaggerInstance);
  versionRouter.get(`/swagger/`, swaggerInstance);
  console.log(versionRoutes[0]);
  versionRoutes.forEach((route) => versionRouter.route(`/`, route));
  baseRouter.route(`/${version}`, versionRouter);
}

registerApiVersion("v1", apiRouterHono, routesV1);
