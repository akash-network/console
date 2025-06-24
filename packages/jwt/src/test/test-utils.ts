import type { JWTPayload } from "../types";
import type { jwtClaimsTestCases } from "./generated/jwt-claims-test-cases";
import { createAkashAddress } from "./seeders/akash-address.seeder";

const ONE_DAY_IN_SECONDS = 60 * 60 * 24;
const TWO_DAYS_IN_SECONDS = 2 * ONE_DAY_IN_SECONDS;

/**
 * Replaces template values in JWT test cases with actual values
 *
 * Supports the following template patterns:
 * - {{.Issuer}} - Replaced with a generated Akash address for the issuer
 * - {{.Provider}} - Replaced with a generated Akash address for the provider
 * - {{.IatCurr}} - Replaced with the current timestamp
 * - {{.Iat24h}} - Replaced with a timestamp 24 hours in the past
 * - {{.NbfCurr}} - Replaced with the current timestamp
 * - {{.Nbf24h}} - Replaced with a timestamp 24 hours in the past
 * - {{.Exp48h}} - Replaced with a timestamp 48 hours in the future
 * @param testCase - The test case containing template values
 * @returns The test case with template values replaced
 */
export function replaceTemplateValues(testCase: (typeof jwtClaimsTestCases)[0]) {
  const now = Math.floor(Date.now() / 1000);
  const issuer = createAkashAddress();
  const provider = createAkashAddress();

  const claims = { ...testCase.claims } as any;
  if (claims.iss === "{{.Issuer}}") claims.iss = issuer;
  if (claims.iat === "{{.IatCurr}}") claims.iat = now;
  if (claims.iat === "{{.Iat24h}}") claims.iat = now + ONE_DAY_IN_SECONDS;
  if (claims.nbf === "{{.NbfCurr}}") claims.nbf = now;
  if (claims.nbf === "{{.Nbf24h}}") claims.nbf = now + ONE_DAY_IN_SECONDS;
  if (claims.exp === "{{.Exp48h}}") claims.exp = now + TWO_DAYS_IN_SECONDS;

  // Convert string timestamps to numbers
  if (typeof claims.iat === "string") claims.iat = parseInt(claims.iat, 10);
  if (typeof claims.exp === "string") claims.exp = parseInt(claims.exp, 10);
  if (typeof claims.nbf === "string") claims.nbf = parseInt(claims.nbf, 10);

  // Replace provider address in permissions if present
  if (claims.leases && Array.isArray(claims.leases.permissions) && claims.leases.permissions.length > 0) {
    claims.leases.permissions = claims.leases.permissions.map((perm: { provider: string; [key: string]: any }) => ({
      ...perm,
      provider: perm.provider === "{{.Provider}}" ? provider : perm.provider
    }));
  }

  return { ...testCase, claims: claims as JWTPayload };
}
