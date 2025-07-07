import { isHttpError } from "@akashnetwork/http-sdk";
import { captureException as captureExceptionInSentry } from "@sentry/nextjs";

export class ErrorHandlerService {
  constructor(private readonly captureException = captureExceptionInSentry) {}

  handleError(error: unknown): void {
    const extra: Record<string, unknown> = {};
    const tags: Record<string, string> = {};

    if (isHttpError(error) && error.response && error.response.status !== 400) {
      tags.status = error.response.status.toString();
      tags.method = error.response.config.method?.toUpperCase() || "UNKNOWN";
      tags.url = error.response.config.url || "UNKNOWN";
      extra.headers = error.response.headers;
    }

    this.captureException(error, {
      extra,
      tags
    });
  }
}
