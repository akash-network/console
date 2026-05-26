export const ERROR_MESSAGES: Record<string, string> = {
  VAL_006: "Cert manager configuration is required.",
  VAL_007: "Let's Encrypt notification email is required for migration.",
  VAL_008: "Some migration inputs are invalid. Review the highlighted fields.",
  VAL_009: "A required field is missing.",
  VAL_010: "Provider domain is required.",
  PRV_009: "Failed to start migration. Please try again or contact support."
};

const GENERIC_FALLBACK = "An error occurred while processing your request. Please try again.";

export interface ParsedApiError {
  message: string;
  code?: string;
  rootError?: string;
  fieldErrors: Record<string, string>;
}

interface DetailEntry {
  field?: unknown;
  message?: unknown;
}

interface ApiErrorShape {
  response?: {
    data?: {
      detail?: {
        error?: { message?: unknown; error_code?: unknown };
        details?: unknown;
      };
    };
  };
}

export function parseApiError(error: unknown): ParsedApiError {
  const fieldErrors: Record<string, string> = {};
  const rootMessages: string[] = [];

  if (!error || typeof error !== "object" || !("response" in error)) {
    return { message: GENERIC_FALLBACK, fieldErrors };
  }

  const detail = (error as ApiErrorShape).response?.data?.detail;
  const errorBlock = detail?.error;
  const code = typeof errorBlock?.error_code === "string" ? errorBlock.error_code : undefined;
  const apiMessage = typeof errorBlock?.message === "string" ? errorBlock.message : undefined;

  if (Array.isArray(detail?.details)) {
    for (const entry of detail.details as DetailEntry[]) {
      if (!entry || typeof entry !== "object") continue;
      const field = typeof entry.field === "string" ? entry.field : undefined;
      const message = typeof entry.message === "string" ? entry.message : undefined;
      if (!field || !message) continue;
      if (field === "__root__") {
        rootMessages.push(message);
      } else {
        fieldErrors[field] = message;
      }
    }
  }

  const mappedCodeMessage = code ? ERROR_MESSAGES[code] : undefined;
  const message = apiMessage || mappedCodeMessage || GENERIC_FALLBACK;
  const rootError = rootMessages.length > 0 ? rootMessages.join("\n") : undefined;

  return { message, code, rootError, fieldErrors };
}
