export function collectFullErrorStack(error: Error | (Error & { errors?: Error[] }) | undefined | null, indent = 0): string {
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

  return stack.join("\n").replace(/^/gm, " ".repeat(indent));
}
