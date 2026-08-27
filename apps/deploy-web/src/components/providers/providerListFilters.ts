import type { ClientProviderList } from "@src/types/provider";

type AuditedProvider = Pick<ClientProviderList, "isAudited" | "verification">;

export function hasAuditOrAttestation(provider: AuditedProvider, isProviderVerificationEnabled: boolean): boolean {
  return provider.isAudited || (isProviderVerificationEnabled && (provider.verification?.summary.validAuditorCount ?? 0) > 0);
}
