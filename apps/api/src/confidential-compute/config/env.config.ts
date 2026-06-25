import { z } from "zod";

export const envSchema = z.object({
  /** AMD Key Distribution Service — source of the VCEK and the ARK/ASK cert chain for SEV-SNP verification. */
  AMD_KDS_BASE_URL: z.string().url().default("https://kdsintf.amd.com"),
  /**
   * Candidate AMD SEV-SNP product names tried against KDS, in order, when the evidence carries no embedded
   * VCEK chain. The report's cpuid bytes don't reliably yield the product, so we probe KDS (404 → next).
   */
  AMD_SNP_PRODUCTS: z
    .string()
    .default("Milan,Genoa,Turin")
    .transform(value =>
      value
        .split(",")
        .map(product => product.trim())
        .filter(Boolean)
    ),
  /** NVIDIA Remote Attestation Service — verifies GPU evidence and returns a signed EAT (JWT). Public, no key. */
  NVIDIA_NRAS_BASE_URL: z.string().url().default("https://nras.attestation.nvidia.com"),
  /** JWKS used to verify the NRAS EAT signature. */
  NVIDIA_NRAS_JWKS_URL: z.string().url().default("https://nras.attestation.nvidia.com/.well-known/jwks.json"),
  /** Intel Trust Authority — verifies TDX quotes. Requires an account-scoped API key. */
  INTEL_ITA_BASE_URL: z.string().url().default("https://api.trustauthority.intel.com"),
  /** Intel Trust Authority API key. Absent in most environments → the Intel TDX path reports `unverifiable`. */
  INTEL_ITA_API_KEY: z.string().optional()
});

export type ConfidentialComputeConfig = z.infer<typeof envSchema>;
