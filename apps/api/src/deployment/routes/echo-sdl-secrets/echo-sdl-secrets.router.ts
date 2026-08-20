import { z } from "@hono/zod-openapi";
import createError from "http-errors";
import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER_OR_API_KEY } from "@src/core/services/openapi-docs/openapi-security";
import { SdlSecretsUnsealerService } from "@src/deployment/services/sdl-secrets-unsealer/sdl-secrets-unsealer.service";

/**
 * TEMPORARY. Exists only to prove the seal round-trip end to end against a live KMS, and must be
 * deleted before sealed intake ships: returning decrypted secrets is precisely the property the
 * whole scheme exists to deny, so no endpoint may do it. The production guard below is a safety
 * net, not a licence to keep this route.
 */
export const echoSdlSecretsRouter = new OpenApiHonoHandler();

const EchoSdlSecretsRequestSchema = z.object({
  seal: z.string().openapi({
    description: "All of a deployment's secrets as a single compact JWE"
  }),
  sdl: z.string().openapi({
    description: "The SDL the seal's optional `sdlHash` claim is checked against"
  })
});

const EchoSdlSecretsResponseSchema = z.object({
  secrets: z.record(z.string()).openapi({
    description: "The decrypted secrets, echoed back verbatim"
  })
});

const route = createRoute({
  method: "post",
  path: "/v1/sdl-secrets-echo",
  summary: "Decrypt sealed SDL secrets and echo them back (development only)",
  tags: ["SDL Secrets"],
  security: SECURITY_BEARER_OR_API_KEY,
  hiddenInOpenApiDocs: true,
  request: {
    body: {
      content: {
        "application/json": {
          schema: EchoSdlSecretsRequestSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: "Returns the decrypted secrets",
      content: {
        "application/json": {
          schema: EchoSdlSecretsResponseSchema
        }
      }
    }
  }
});

echoSdlSecretsRouter.openapi(route, async function routeEchoSdlSecrets(c) {
  if (container.resolve(CoreConfigService).get("NODE_ENV") === "production") {
    throw createError(404, "Not Found");
  }

  const { seal, sdl } = c.req.valid("json");
  const secrets = await container.resolve(SdlSecretsUnsealerService).open({ seal, sdl });

  return c.json({ secrets }, 200);
});
