import { OpenAPIHono } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import routesV1 from "../routes/v1";

export const apiRouter = new OpenAPIHono();

function registerApiVersion(version: string, baseRouter: OpenAPIHono, versionRoutes: OpenAPIHono[]) {
  const versionRouter = new OpenAPIHono();
  versionRouter.doc(`/doc`, {
    openapi: "3.0.0",
    servers: [
      { url: `http://localhost:8787/${version}`, description: "Localhost" },
      { url: `https://api-preview.cloudmos.io/${version}`, description: "Online Preview" }
    ],
    info: {
      title: "Cloudmos API",
      description: "Access Akash data from our indexer",
      version: version
    }
  });
  const swaggerInstance = swaggerUI({ url: `/${version}/doc` });

  versionRouter.get(`/swagger`, swaggerInstance);
  versionRouter.get(`/swagger/`, swaggerInstance);

  versionRoutes.forEach((route) => versionRouter.route(`/`, route));
  baseRouter.route(`/${version}`, versionRouter);
}

registerApiVersion("v1", apiRouter, routesV1);
