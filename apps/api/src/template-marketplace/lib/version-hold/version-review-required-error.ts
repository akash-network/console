import createError from "http-errors";

import type { TemplateVersionHoldReason } from "./version-hold-reasons";

export const TEMPLATE_VERSION_REVIEW_REQUIRED_ERROR_CODE = "template_version_review_required";

/** For a route that can save a version but has no way to return one that waits for review. */
export function createVersionReviewRequiredError(holdReasons: TemplateVersionHoldReason[]) {
  return createError(409, "This change needs a review by Akash staff. Save it as a new version from the template's Edit configuration page.", {
    errorCode: TEMPLATE_VERSION_REVIEW_REQUIRED_ERROR_CODE,
    data: { holdReasons }
  });
}
