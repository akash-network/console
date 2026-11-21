import { describe, expect, it } from "vitest";

import { createChecksFailedError, createRequirementsUnmetError, createTermsVersionMismatchError } from "./publish-refusals";
import { COMMUNITY_TEMPLATE_TERMS_VERSION, type PublishRequirement } from "./publish-requirements";

describe(createRequirementsUnmetError.name, () => {
  it("answers 403 with the unmet keys and every requirement", () => {
    const requirements: PublishRequirement[] = [
      { key: "email_verified", met: true },
      { key: "organization_payment", met: false },
      { key: "publisher_role", met: false },
      { key: "publisher_in_good_standing", met: true }
    ];

    expect(createRequirementsUnmetError(requirements)).toMatchObject({
      status: 403,
      message: "This template cannot be made public yet: organization_payment, publisher_role",
      errorCode: "template_publish_requirements_unmet",
      data: { unmet: ["organization_payment", "publisher_role"], requirements }
    });
  });
});

describe(createChecksFailedError.name, () => {
  it("answers 400 with every check and a message joining the issues found", () => {
    const checkResults = {
      ranAt: "2026-11-18T10:00:00.000Z",
      checks: [
        { key: "sdl_valid" as const, status: "passed" as const, issues: [] },
        { key: "fixed_tags" as const, status: "failed" as const, issues: [{ message: "Pin web." }, { message: "Pin db." }] },
        { key: "name_not_reserved" as const, status: "failed" as const, issues: [{ message: "Rename it." }] }
      ]
    };

    expect(createChecksFailedError(checkResults)).toMatchObject({
      status: 400,
      message: "Pin web. Pin db. Rename it.",
      errorCode: "template_publish_checks_failed",
      data: { checks: checkResults.checks, ranAt: "2026-11-18T10:00:00.000Z" }
    });
  });
});

describe(createTermsVersionMismatchError.name, () => {
  it("answers 409 with the terms version to accept", () => {
    expect(createTermsVersionMismatchError()).toMatchObject({
      status: 409,
      message: "The community template terms changed. Read and accept the current terms to make the template public.",
      errorCode: "template_terms_version_mismatch",
      data: { termsVersion: COMMUNITY_TEMPLATE_TERMS_VERSION }
    });
  });
});
