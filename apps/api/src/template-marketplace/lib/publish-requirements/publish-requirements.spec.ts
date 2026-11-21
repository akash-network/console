import { describe, expect, it } from "vitest";

import { MAX_TERMS_VERSION_LENGTH } from "../../model-schemas/template-terms-acceptance/template-terms-acceptance.schema";
import { areRequirementsMet, COMMUNITY_TEMPLATE_TERMS_VERSION, evaluatePublishRequirements, type PublishRequirementFacts } from "./publish-requirements";

const ALL_MET: PublishRequirementFacts = { isEmailVerified: true, hasOrganizationPaid: true, mayPublishForOrganization: true, isPublisherSuspended: false };

describe(evaluatePublishRequirements.name, () => {
  it("meets every requirement of a verified owner of a paying organization in good standing, in a fixed order", () => {
    expect(evaluatePublishRequirements(ALL_MET)).toEqual([
      { key: "email_verified", met: true },
      { key: "organization_payment", met: true },
      { key: "publisher_role", met: true },
      { key: "publisher_in_good_standing", met: true }
    ]);
  });

  it.each([
    { fact: { isEmailVerified: false }, unmet: "email_verified" },
    { fact: { hasOrganizationPaid: false }, unmet: "organization_payment" },
    { fact: { mayPublishForOrganization: false }, unmet: "publisher_role" },
    { fact: { isPublisherSuspended: true }, unmet: "publisher_in_good_standing" }
  ])("leaves only $unmet unmet", ({ fact, unmet }) => {
    const requirements = evaluatePublishRequirements({ ...ALL_MET, ...fact });

    expect(requirements.filter(requirement => !requirement.met).map(requirement => requirement.key)).toEqual([unmet]);
  });
});

describe(areRequirementsMet.name, () => {
  it("answers true when every requirement is met", () => {
    expect(areRequirementsMet(evaluatePublishRequirements(ALL_MET))).toBe(true);
  });

  it("answers false once one requirement is unmet", () => {
    expect(areRequirementsMet(evaluatePublishRequirements({ ...ALL_MET, isEmailVerified: false }))).toBe(false);
  });
});

describe("COMMUNITY_TEMPLATE_TERMS_VERSION", () => {
  it("fits the column an acceptance is recorded in", () => {
    expect(COMMUNITY_TEMPLATE_TERMS_VERSION.length).toBeGreaterThan(0);
    expect(COMMUNITY_TEMPLATE_TERMS_VERSION.length).toBeLessThanOrEqual(MAX_TERMS_VERSION_LENGTH);
  });
});
