import { isProd } from "@src/utils/constants";
import { OpenAPIHono } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import routes from "../routes/internal";

export const internalRouter = new OpenAPIHono();

const servers = [{ url: `https://api.cloudmos.io/internal`, description: "Production" }];
if (!isProd) {
  servers.unshift({ url: `http://localhost:3080/internal`, description: "Localhost" });
}

internalRouter.doc(`/doc`, {
  openapi: "3.0.0",
  servers: servers,
  info: {
    title: "Cloudmos Internal API",
    description: "APIs for internal use that are not part of the public API. There is no garantees of stability or backward compatibility.",
    version: "test"
  }
});

const swaggerInstance = swaggerUI({ url: `/internal/doc` });

internalRouter.get(`/swagger`, swaggerInstance);

routes.forEach((route) => internalRouter.route(`/`, route));
