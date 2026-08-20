import { z } from "@hono/zod-openapi";
import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER_OR_API_KEY } from "@src/core/services/openapi-docs/openapi-security";
import { SDL_SECRETS_REQUIRED_CLAIMS } from "@src/deployment/config/sdl-secrets.config";
import { SdlSecretsContextService } from "@src/deployment/services/sdl-secrets-context/sdl-secrets-context.service";

export const getSDLSecretsContextRouter = new OpenApiHonoHandler();

const SDLSecretsContextResponseSchema = z.object({
  sub: z.string().openapi({
    description: "The subject of the SDL secrets context"
  }),
  kid: z.string().openapi({
    description: "The key ID of the SDL secrets context"
  }),
  jwk: z
    .object({
      kty: z.string(),
      n: z.string(),
      e: z.string(),
      use: z.string(),
      alg: z.string()
    })
    .openapi({
      description: "The JSON Web Key used to encrypt the SDL secrets"
    }),
  requiredClaims: z.array(z.enum(SDL_SECRETS_REQUIRED_CLAIMS)).openapi({
    description: "The required claims for the SDL secrets context"
  })
});

const route = createRoute({
  method: "get",
  path: "/v1/sdl-secrets-context",
  summary: "Get SDL secrets encryption context",
  tags: ["SDL Secrets"],
  security: SECURITY_BEARER_OR_API_KEY,
  responses: {
    200: {
      description: "Returns SDL secrets context",
      content: {
        "application/json": {
          schema: SDLSecretsContextResponseSchema
        }
      }
    },
    503: {
      description: "SDL secrets encryption is unavailable",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string()
          })
        }
      }
    }
  }
});
getSDLSecretsContextRouter.openapi(route, async function routeGetSDLSecretsContext(c) {
  const result = await container.resolve(SdlSecretsContextService).getContext();

  return c.json(result, 200);
});
