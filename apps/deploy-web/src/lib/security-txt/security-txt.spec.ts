import { describe, expect, it } from "vitest";

import { buildSecurityTxt, MAX_SECURITY_TXT_VALIDITY_DAYS, SECURITY_CONTACT_URL, SECURITY_POLICY_URL } from "./security-txt";

describe(buildSecurityTxt.name, () => {
  it("lists the contact, expiry, language, canonical address and policy as one field per line", () => {
    const securityTxt = buildSecurityTxt(new Date("2026-11-10T12:00:00.000Z"));

    expect(securityTxt).toBe(
      [
        "Contact: https://github.com/akash-network/console/security/advisories/new",
        "Expires: 2027-05-09T12:00:00.000Z",
        "Preferred-Languages: en",
        "Canonical: https://console.akash.network/.well-known/security.txt",
        "Policy: https://github.com/akash-network/console/security/policy",
        ""
      ].join("\n")
    );
  });

  it("points the contact and the policy at the repository", () => {
    const securityTxt = buildSecurityTxt(new Date("2026-11-10T12:00:00.000Z"));

    expect(securityTxt).toContain(`Contact: ${SECURITY_CONTACT_URL}\n`);
    expect(securityTxt).toContain(`Policy: ${SECURITY_POLICY_URL}\n`);
  });

  it("expires less than a year after the moment it is built", () => {
    const now = new Date("2028-02-29T00:00:00.000Z");

    const expiresAt = new Date(buildSecurityTxt(now).match(/^Expires: (.+)$/m)![1]);

    const validityDays = (expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
    expect(validityDays).toBe(MAX_SECURITY_TXT_VALIDITY_DAYS);
    expect(validityDays).toBeLessThan(365);
  });
});
