import createError from "http-errors";

export const TEMPLATE_IMPORTED_READ_ONLY_ERROR_CODE = "template_imported_read_only";

export function createImportedReadOnlyError() {
  return createError(409, "This template is imported from the awesome-akash repository and can only be changed there", {
    errorCode: TEMPLATE_IMPORTED_READ_ONLY_ERROR_CODE
  });
}
