export function collectFullErrorStack(error: Error | AggregateError | ErrorWithResponse | undefined | null, indent = 0): string {
  const currentError = error;
  if (!currentError) return "";

  const stack: string[] = [currentError.stack!];

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
    stack.push(
      "\nResponse:",
      `\n\nRequest: ${requestedPath}`,
      `\n\nStatus: ${currentError.response.status}`,
      `\n\nError: ${currentError.response.data?.message || "Not specified"} (code: ${currentError.response.data?.code || "Not specified"})`
    );
  }

  return stack.join("\n").replace(/^/gm, " ".repeat(indent));
}

type ErrorWithResponse = Error & {
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
