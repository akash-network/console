import { container } from "tsyringe";

import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";
import { SECURITY_BEARER_OR_API_KEY } from "@src/core/services/openapi-docs/openapi-security";
import { AttestationController } from "../controllers/attestation.controller";
import { VerifyAttestationRequestSchema, VerifyAttestationResponseSchema } from "../http-schemas/attestation.schema";

export const attestationRouter = new OpenApiHonoHandler();

const verifyAttestationRoute = createRoute({
  method: "post",
  operationId: "validateConfidentialComputeAttestation",
  path: "/v1/confidential-compute/attestation/validate",
  summary: "Validate confidential compute attestation evidence against the hardware vendors (AMD SEV-SNP, Intel TDX, NVIDIA)",
  tags: ["Confidential Compute"],
  // Authenticated: the endpoint makes outbound, partly metered calls to vendor services, so each request is
  // tied to a known caller. The downloaded evidence itself is self-contained; no per-lease authorization is needed.
  security: SECURITY_BEARER_OR_API_KEY,
  bodyLimit: { maxSize: 256 * 1024 },
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: VerifyAttestationRequestSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: "Per-report attestation verdicts",
      content: {
        "application/json": {
          schema: VerifyAttestationResponseSchema
        }
      }
    },
    400: {
      description: "Invalid request body"
    }
  }
});

attestationRouter.openapi(verifyAttestationRoute, async function routeVerifyAttestation(c) {
  const body = c.req.valid("json");
  const result = await container.resolve(AttestationController).verify(body);
  return c.json(result, 200);
});
