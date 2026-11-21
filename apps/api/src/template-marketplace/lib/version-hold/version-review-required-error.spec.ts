import { describe, expect, it } from "vitest";

import { OFFICIAL_TEMPLATE_HOLD_REASON } from "./version-hold-reasons";
import { createVersionReviewRequiredError, TEMPLATE_VERSION_REVIEW_REQUIRED_ERROR_CODE } from "./version-review-required-error";

describe(createVersionReviewRequiredError.name, () => {
  it("answers a conflict that carries why the version would wait for staff and where to save it instead", () => {
    const error = createVersionReviewRequiredError([OFFICIAL_TEMPLATE_HOLD_REASON]);

    expect(error).toMatchObject({
      status: 409,
      message: "This change needs a review by Akash staff. Save it as a new version from the template's Edit configuration page.",
      errorCode: "template_version_review_required",
      data: { holdReasons: [OFFICIAL_TEMPLATE_HOLD_REASON] }
    });
    expect(TEMPLATE_VERSION_REVIEW_REQUIRED_ERROR_CODE).toBe("template_version_review_required");
  });
});
