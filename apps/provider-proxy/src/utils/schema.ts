import { JwtTokenManager } from "@akashnetwork/chain-sdk";
import type { SupportedChainNetworks } from "@akashnetwork/net";
import { netConfig } from "@akashnetwork/net";
import { z } from "@hono/zod-openapi";

import { isValidBech32Address } from "./isValidBech32";
import { validateClientCertificateAttrs } from "./validateClientCertificateAttrs";

export const providerRequestSchema = z.object({
  auth: z
    .discriminatedUnion("type", [
      z.object({
        type: z.literal("mtls"),
        certPem: z.string(),
        keyPem: z.string()
      }),
      z.object({
        type: z.literal("jwt"),
        token: z.string()
      })
    ])
    .optional(),
  url: z.string().url(),
  network: z.enum(netConfig.getSupportedNetworks() as [SupportedChainNetworks]).describe("Blockchain network"),
  providerAddress: z.string().refine(isValidBech32Address, "is not bech32 address").describe("Bech32 representation of provider wallet address"),
  chainNetwork: z
    .enum(netConfig.getSupportedNetworks() as [SupportedChainNetworks])
    .describe('Deprecated blockchain network. Use "network" instead.')
    .optional(),
  certPem: z.string().describe('Deprecated certificate. Use mtls auth type  with "auth.certPem" instead.').optional(),
  keyPem: z.string().describe('Deprecated key. Use mtls auth type  with "auth.keyPem" instead.').optional()
});

export type ProviderRequestSchema = Omit<z.infer<typeof providerRequestSchema>, "chainNetwork" | "certPem" | "keyPem">;

/** this can be attached as .superRefine in zod v4 */
export function addProviderAuthValidation<T extends z.ZodType<any>>(schema: T): z.ZodEffects<T> {
  return z
    .preprocess(data => {
      const { chainNetwork, certPem, keyPem, ...normalizedData } = data as z.infer<typeof providerRequestSchema>;
      if (chainNetwork) {
        normalizedData.network = chainNetwork;
      }
      if (!normalizedData.auth && (certPem || keyPem)) {
        normalizedData.auth = { type: "mtls", certPem: certPem || "", keyPem: keyPem || "" };
      }
      return normalizedData;
    }, schema)
    .superRefine((data, ctx) => {
      if (data.auth?.type === "mtls" && data.auth.certPem) {
        const validationResult = validateClientCertificateAttrs(data.auth.certPem);
        if (!validationResult.ok) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "is not a valid certificate",
            path: ["auth", "certPem"],
            params: {
              reason: validationResult.code
            }
          });
        }
      }

      if (data.auth?.type === "jwt" && data.auth.token) {
        const validationResult = validateJwtPayload(data.auth.token);
        if (!validationResult.isValid) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "is not a valid JWT token",
            path: ["auth", "token"],
            params: {
              errors: validationResult.errors
            }
          });
        }
      }
    }) as unknown as z.ZodEffects<T>;
}

const jwtTokenManager = new JwtTokenManager({
  signArbitrary: () => {
    throw new Error("Cannot generate token: it was created for payload validation only");
  }
});
function validateJwtPayload(token: string): { isValid: boolean; errors?: string[] } {
  try {
    return jwtTokenManager.validatePayload(jwtTokenManager.decodeToken(token));
  } catch (error) {
    return { isValid: false, errors: ["Invalid token"] };
  }
}
