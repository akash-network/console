import type { jwtClaimsTestCases } from "../generated/jwt-claims-test-cases";
import type { JWTPayload } from "../types";
import { AkashAddressSeeder } from "./seeders/akash-address.seeder";

/**
 * Replaces template values in JWT test cases with actual values
 * @param testCase - The test case containing template values
 * @returns The test case with template values replaced
 */
export function replaceTemplateValues(testCase: (typeof jwtClaimsTestCases)[0]) {
  const now = Math.floor(Date.now() / 1000);
  const issuer = AkashAddressSeeder.create();
  const provider = AkashAddressSeeder.create();

  const claims = { ...testCase.claims } as any;
  if (claims.iss === "{{.Issuer}}") claims.iss = issuer;
  if (claims.iat === "{{.Iat24h}}") claims.iat = now - 86400; // 24 hours ago
  if (claims.exp === "{{.Exp48h}}") claims.exp = now + 172800; // 48 hours from now

  // Convert string timestamps to numbers
  if (typeof claims.iat === "string") claims.iat = parseInt(claims.iat, 10);
  if (typeof claims.exp === "string") claims.exp = parseInt(claims.exp, 10);
  if (typeof claims.nbf === "string") claims.nbf = parseInt(claims.nbf, 10);

  // Replace provider address in permissions if present
  if (claims.leases?.permissions) {
    claims.leases.permissions = claims.leases.permissions.map((perm: { provider: string; [key: string]: any }) => ({
      ...perm,
      provider: perm.provider === "{{.Provider}}" ? provider : perm.provider
    }));
  }

  return { ...testCase, claims: claims as JWTPayload };
}
