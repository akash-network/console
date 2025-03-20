export function collectFullErrorStack(error: Error | undefined | null, indent = 0): string {
  const currentError = error as unknown as ErrorWithCause;
  if (!currentError) return "";

  const stack: string[] = [currentError.stack!];

  if (currentError.cause) {
    stack.push("\nCaused by:", collectFullErrorStack(currentError.cause, indent + 2));
  }

  if (currentError.errors?.length) {
    const errorStacks = currentError.errors.map(error => collectFullErrorStack(error, indent + 2));
    stack.push("\nErrors:", ...errorStacks);
  }

  return stack.join("\n").replace(/^/gm, " ".repeat(indent));
}

export type ErrorWithCause = Error & { cause?: ErrorWithCause; errors?: ErrorWithCause[] };
