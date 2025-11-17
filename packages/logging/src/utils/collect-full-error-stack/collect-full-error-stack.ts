export function collectFullErrorStack(error: string | Error | AggregateError | ErrorWithResponse | ErrorWithData | undefined | null, indent = 0): string {
  if (!error) return "";
  if (typeof error === "string") return sanitizeString(error);

  const currentError = error;
  const stack = currentError.stack ? currentError.stack.split("\n") : [];

  if (stack.length > 0 && "code" in currentError) {
    stack[0] = `${stack[0]} (code: ${currentError.code})`;
  }

  stack[0] = sanitizeString(stack[0]);

  if (currentError.cause) {
    stack.push("\nCaused by:", collectFullErrorStack(currentError.cause as Error, indent + 2));
  }

  if ("errors" in currentError && currentError.errors?.length) {
    const errorStacks = currentError.errors.map(error => collectFullErrorStack(error, indent + 2));
    stack.push("\nErrors:", ...errorStacks);
  }

  if ("response" in currentError && currentError.response) {
    const requestedPath = currentError.response.config?.url
      ? `${currentError.response.config.method?.toUpperCase() || "(HTTP method not specified)"} ${currentError.response.config?.url}`
      : "Unknown request";
    const body = currentError.response.data ? JSON.stringify(currentError.response.data) : "No body";
    stack.push(
      "\nResponse:",
      `\nRequest: ${requestedPath}`,
      `\nStatus: ${currentError.response.status}`,
      `\nError: ${sanitizeString(currentError.response.data?.message) || "Not specified"} (code: ${currentError.response.data?.code || "Not specified"})`,
      `\nBody: ${body.length > 200 ? `${body.slice(0, 200)}...` : body}`
    );
  }

  return stack.join("\n").replace(/^/gm, " ".repeat(indent));
}

type ErrorWithResponse = Error & {
  code?: string;
  response?: {
    status: number;
    config?: {
      url: string;
      method: string;
    };
    data?: {
      message?: string;
      code?: unknown;
    };
  };
};
type AggregateError = Error & { errors?: Error[] };
type ErrorWithData = Error & { data?: Record<string, unknown>; originalError?: Error };

export function sanitizeString(str: string | undefined | null): string {
  if (!str) return "";

  let s = String(str);
  if (typeof s.normalize === "function") s = s.normalize("NFC");
  s = replaceBrokenUtf8(s);
  s = scrubControls(s);
  return s;
}

const RE_FFFD = /\uFFFD+/g;
function replaceBrokenUtf8(str: string): string {
  return str.replace(RE_FFFD, "\\uFFFD+");
}

function scrubControls(str: string): string {
  return (
    str
      .replace(/\r/g, "\\r")
      .replace(/\n/g, "\\n")
      .replace(/\t/g, "\\t")
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ch => `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`)
  );
}
