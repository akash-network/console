import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";

import { env } from "@src/utils/env";
import routes from "../routes/deployment";

export const deploymentRouter = new OpenAPIHono();

deploymentRouter.doc(`/doc`, {
  openapi: "3.0.0",
  servers: [{ url: `${env.SERVER_ORIGIN}/deployments` }],
  info: {
    title: "Deployment API",
    description: "APIs for deployments using credit cards.",
    version: "v1"
  }
});

const swaggerInstance = swaggerUI({ url: `/deployments/doc` });

deploymentRouter.get(`/swagger`, swaggerInstance);

routes.forEach(route => deploymentRouter.route(`/`, route));
