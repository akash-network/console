export class RichError extends Error {
  static enrich(error: unknown, code?: string | number, data?: Record<string, unknown>) {
    const message = this.extractMessage(error);
    const stack = this.extractStack(error);
    const richError = new RichError(message, code, data, error);
    if (stack) {
      richError.stack = stack;
    }
    return richError;
  }

  static extractMessage(error: unknown): string {
    if (typeof error === "string") {
      return error;
    }
    if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
      return error.message;
    }

    return "Unknown error occurred.";
  }

  static extractStack(error: unknown): string | undefined {
    if (error && typeof error === "object" && "stack" in error && typeof error.stack === "string") {
      return error.stack;
    }
  }

  constructor(
    public message: string,
    public code: string | number = "UNDEFINED",
    public data: Record<string, unknown> = {},
    cause?: unknown
  ) {
    super(message, { cause });
    this.name = "RichError";
  }
}
