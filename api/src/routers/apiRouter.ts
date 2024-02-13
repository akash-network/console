import { OpenAPIHono } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import routesV1 from "../routes/v1";
import { isProd } from "@src/utils/constants";

export const apiRouter = new OpenAPIHono();

function registerApiVersion(version: string, baseRouter: OpenAPIHono, versionRoutes: OpenAPIHono[]) {
  const versionRouter = new OpenAPIHono();

  let servers = [{ url: `https://api.cloudmos.io/${version}`, description: "Production" }];
  if (!isProd) {
    servers.unshift({ url: `http://localhost:3080/${version}`, description: "Localhost" });
  }

  versionRouter.doc(`/doc`, {
    openapi: "3.0.0",
    servers: servers,
    info: {
      title: "Cloudmos API",
      description: "Access Akash data from our indexer",
      version: version
    }
  });
  const swaggerInstance = swaggerUI({ url: `/${version}/doc` });

  versionRouter.get(`/swagger`, swaggerInstance);
  versionRouter.get(`/swagger/`, (c) => c.redirect(`/${version}/swagger`));

  versionRoutes.forEach((route) => versionRouter.route(`/`, route));
  baseRouter.route(`/${version}`, versionRouter);
}

registerApiVersion("v1", apiRouter, routesV1);
