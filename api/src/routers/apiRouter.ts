import express from "express";
import { OpenAPIHono } from "@hono/zod-openapi";
import asyncHandler from "express-async-handler";
import { swaggerUI } from "@hono/swagger-ui";
import routesV1 from "../routes/v1";
import { getProviderDeployments, getProviderDeploymentsCount } from "@src/db/deploymentProvider";

export const apiRouter = express.Router();

export const apiRouterHono = new OpenAPIHono();

function registerApiVersion(version: string, baseRouter: OpenAPIHono, versionRoutes: OpenAPIHono[]) {
  const versionRouter = new OpenAPIHono();
  versionRouter.doc(`/doc`, {
    openapi: "3.0.0",
    servers: [
      { url: `http://localhost:8787/${version}`, description: "Localhost" },
      { url: `https://api-preview.cloudmos.io/${version}`, description: "Online Preview" }
    ], // TODO
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

registerApiVersion("v1", apiRouterHono, routesV1);

apiRouter.get(
  "/providers/:provider/deployments/:skip/:limit/:status?",
  asyncHandler(async (req, res) => {
    const skip = parseInt(req.params.skip);
    const limit = Math.min(100, parseInt(req.params.limit));
    const statusParam = req.params.status as "active" | "closed" | undefined;

    if (statusParam && statusParam !== "active" && statusParam !== "closed") {
      res.status(400).send(`Invalid status filter: "${statusParam}". Valid values are "active" and "closed".`);
      return;
    }

    const deploymentCountQuery = getProviderDeploymentsCount(req.params.provider, statusParam);
    const deploymentsQuery = getProviderDeployments(req.params.provider, skip, limit, statusParam);

    const [deploymentCount, deployments] = await Promise.all([deploymentCountQuery, deploymentsQuery]);

    res.send({
      total: deploymentCount,
      deployments: deployments
    });
  })
);
