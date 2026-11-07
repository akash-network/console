import createError from "http-errors";

export const TEMPLATE_INVALID_ERROR_CODE = "template_invalid";

export function createTemplateInvalidError(issues: string[]) {
  return createError(400, issues.join("; "), { errorCode: TEMPLATE_INVALID_ERROR_CODE, data: { issues } });
}
