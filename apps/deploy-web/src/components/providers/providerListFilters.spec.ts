import { describe, expect, it } from "vitest";

import type { ClientProviderList } from "@src/types/provider";
import { hasAuditOrAttestation } from "./providerListFilters";

describe(hasAuditOrAttestation.name, () => {
  it.each([
    { legacyAudited: true, verificationEnabled: false, validAuditorCount: null, expected: true },
    { legacyAudited: false, verificationEnabled: true, validAuditorCount: 1, expected: true },
    { legacyAudited: false, verificationEnabled: true, validAuditorCount: 0, expected: false },
    { legacyAudited: false, verificationEnabled: true, validAuditorCount: null, expected: false },
    { legacyAudited: false, verificationEnabled: false, validAuditorCount: 1, expected: false }
  ])(
    "returns $expected for legacy=$legacyAudited enabled=$verificationEnabled auditors=$validAuditorCount",
    ({ legacyAudited, verificationEnabled, validAuditorCount, expected }) => {
      const provider = {
        isAudited: legacyAudited,
        verification:
          validAuditorCount === null
            ? null
            : {
                summary: { validAuditorCount }
              }
      } as ClientProviderList;

      expect(hasAuditOrAttestation(provider, verificationEnabled)).toBe(expected);
    }
  );
});
