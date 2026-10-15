import { extractApiErrorCode } from "@akashnetwork/openapi-sdk";

import { SUPPORT_EMAIL } from "@src/config/ui.config";
import { PROJECT_LIMIT_REACHED_ERROR_CODE } from "@src/types/project";
import { readRefusedLimit } from "@src/utils/refusedLimit";

export function describeProjectCreationFailure(error: unknown): string {
  if (extractApiErrorCode(error) !== PROJECT_LIMIT_REACHED_ERROR_CODE) return "Try again in a moment.";

  const limit = readRefusedLimit(error);
  const reached = limit ? `This organization has reached its limit of ${limit} projects.` : "This organization has reached the number of projects it can have.";

  return `${reached} Delete a project it no longer needs, or contact ${SUPPORT_EMAIL} to raise the limit.`;
}
