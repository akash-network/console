import { isApiError } from "@akashnetwork/openapi-sdk";

import { readRemovedTemplate } from "@src/components/templates/removed/readRemovedTemplate";

export type ForkRefusal = "source_removed" | "source_unreadable";

const SOURCE_UNREADABLE_STATUS = 404;

export const FORK_REFUSAL_MESSAGES: Record<ForkRefusal, string> = {
  source_removed: "The template you forked was removed, so a copy of it can't be saved.",
  source_unreadable: "You can no longer open the template you forked, so a copy of it can't be saved."
};

/** Why the API would not save a copy that names its source, when the reason is the source itself. */
export function readForkRefusal(error: unknown): ForkRefusal | undefined {
  if (readRemovedTemplate(error)) return "source_removed";
  if (isApiError(error) && error.status === SOURCE_UNREADABLE_STATUS) return "source_unreadable";
  return undefined;
}
