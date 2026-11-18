import createError from "http-errors";

export const TEMPLATE_REMOVED_ERROR_CODE = "template_removed";

/** Carries the title alone, which is all that is kept of a removed template, so its link can still say what was there. */
export function createTemplateRemovedError(title: string) {
  return createError(410, "This template was removed", { errorCode: TEMPLATE_REMOVED_ERROR_CODE, data: { title } });
}
