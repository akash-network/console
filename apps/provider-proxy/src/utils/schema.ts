import type { SupportedChainNetworks } from "@akashnetwork/net";
import { netConfig } from "@akashnetwork/net";
import { z } from "@hono/zod-openapi";

import { isValidBech32Address } from "./isValidBech32";
import { validateClientCertificateAttrs } from "./validateClientCertificateAttrs";

export const providerRequestSchema = z.object({
  certPem: z.string().optional(),
  keyPem: z.string().optional(),
  url: z.string().url(),
  providerAddress: z.string().refine(isValidBech32Address, "is not bech32 address").describe("Bech32 representation of provider wallet address")
});

export const chainNetworkSchema = z.enum(netConfig.getSupportedNetworks() as [SupportedChainNetworks]).describe("Blockchain network");

/** this can be attached as .superRefine in zod v4 */
export function addCertificateValidation(schema: z.ZodType<any>) {
  return schema.superRefine((data, ctx) => {
    if ((!data.certPem && data.keyPem) || (data.certPem && !data.keyPem)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "certPem and keyPem either both must be provider or both must be empty",
        path: ["certPem"],
        params: {
          reason: "missingCertPair"
        }
      });
    }

    if (data.certPem && data.keyPem) {
      const validationResult = validateClientCertificateAttrs(data.certPem);
      if (!validationResult.ok) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "is not a valid certificate",
          path: ["certPem"],
          params: {
            reason: validationResult.code
          }
        });
      }
    }
  });
}
