import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER_OR_API_KEY } from "@src/core/services/openapi-docs/openapi-security";
import { FavoriteProvidersController } from "@src/user/controllers/favorite-providers/favorite-providers.controller";
import {
  CreateFavoriteProvidersRequestSchema,
  DeleteFavoriteProviderParamsSchema,
  FavoriteProvidersResponseSchema
} from "@src/user/http-schemas/favorite-providers.schema";

export const favoriteProvidersRouter = new OpenApiHonoHandler();

const favoriteProvidersResponse = {
  description: "The user's favorite providers",
  content: { "application/json": { schema: FavoriteProvidersResponseSchema } }
};

const listFavoriteProvidersRoute = createRoute({
  method: "get",
  path: "/v1/favorite-providers",
  operationId: "listFavoriteProviders",
  summary: "List the providers the user marked as favorites",
  tags: ["Users"],
  security: SECURITY_BEARER_OR_API_KEY,
  responses: {
    200: favoriteProvidersResponse,
    401: { description: "Unauthorized" }
  }
});

favoriteProvidersRouter.openapi(listFavoriteProvidersRoute, async function routeListFavoriteProviders(c) {
  return c.json(await container.resolve(FavoriteProvidersController).list(), 200);
});

const createFavoriteProvidersRoute = createRoute({
  method: "post",
  path: "/v1/favorite-providers",
  operationId: "createFavoriteProviders",
  summary: "Add providers to the user's favorites",
  tags: ["Users"],
  security: SECURITY_BEARER_OR_API_KEY,
  bodyLimit: { maxSize: 64 * 1024 },
  request: {
    body: { required: true, content: { "application/json": { schema: CreateFavoriteProvidersRequestSchema } } }
  },
  responses: {
    200: favoriteProvidersResponse,
    400: { description: "Invalid request body" },
    401: { description: "Unauthorized" },
    422: { description: "The user would have more favorite providers than allowed" }
  }
});

favoriteProvidersRouter.openapi(createFavoriteProvidersRoute, async function routeCreateFavoriteProviders(c) {
  const { data } = c.req.valid("json");
  return c.json(await container.resolve(FavoriteProvidersController).add(data), 200);
});

const deleteFavoriteProviderRoute = createRoute({
  method: "delete",
  path: "/v1/favorite-providers/{providerAddress}",
  operationId: "deleteFavoriteProvider",
  summary: "Remove a provider from the user's favorites",
  tags: ["Users"],
  security: SECURITY_BEARER_OR_API_KEY,
  request: { params: DeleteFavoriteProviderParamsSchema },
  responses: {
    200: favoriteProvidersResponse,
    400: { description: "Invalid provider address" },
    401: { description: "Unauthorized" }
  }
});

favoriteProvidersRouter.openapi(deleteFavoriteProviderRoute, async function routeDeleteFavoriteProvider(c) {
  const { providerAddress } = c.req.valid("param");
  return c.json(await container.resolve(FavoriteProvidersController).remove(providerAddress), 200);
});
