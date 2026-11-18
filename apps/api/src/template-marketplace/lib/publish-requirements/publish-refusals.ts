import createError from "http-errors";

import type { PublishCheckResults } from "@src/template-marketplace/lib/publish-checks/publish-check-results";
import { COMMUNITY_TEMPLATE_TERMS_VERSION, type PublishRequirement } from "./publish-requirements";

export const PUBLISH_REQUIREMENTS_UNMET_ERROR_CODE = "template_publish_requirements_unmet";
export const PUBLISH_CHECKS_FAILED_ERROR_CODE = "template_publish_checks_failed";
export const TERMS_VERSION_MISMATCH_ERROR_CODE = "template_terms_version_mismatch";

export function createRequirementsUnmetError(requirements: PublishRequirement[]) {
  const unmet = requirements.filter(requirement => !requirement.met).map(requirement => requirement.key);

  return createError(403, `This template cannot be made public yet: ${unmet.join(", ")}`, {
    errorCode: PUBLISH_REQUIREMENTS_UNMET_ERROR_CODE,
    data: { unmet, requirements }
  });
}

export function createChecksFailedError(checkResults: PublishCheckResults) {
  const issues = checkResults.checks.flatMap(check => check.issues.map(issue => issue.message));

  return createError(400, issues.join(" "), { errorCode: PUBLISH_CHECKS_FAILED_ERROR_CODE, data: { checks: checkResults.checks, ranAt: checkResults.ranAt } });
}

export function createTermsVersionMismatchError() {
  return createError(409, "The community template terms changed. Read and accept the current terms to make the template public.", {
    errorCode: TERMS_VERSION_MISMATCH_ERROR_CODE,
    data: { termsVersion: COMMUNITY_TEMPLATE_TERMS_VERSION }
  });
}
