import { LoggerService } from "@akashnetwork/logging";
import { singleton } from "tsyringe";

import { InjectSentry, Sentry } from "@src/core/providers/sentry.provider";
import { SentryEventService } from "@src/core/services/sentry-event/sentry-event.service";

@singleton()
export class ErrorService {
  private readonly logger = new LoggerService();

  constructor(
    @InjectSentry() private readonly sentry: Sentry,
    private readonly sentryEventService: SentryEventService
  ) {}

  async execWithErrorHandler<T>(extraLog: Record<string, unknown>, cb: () => Promise<T>, onError?: (error: unknown) => void): Promise<T> {
    try {
      return await cb();
    } catch (error) {
      const sentryEventId = this.sentry.captureEvent(this.sentryEventService.toEvent(error));
      this.logger.error({ error: error.stack, sentryEventId, ...extraLog });

      if (typeof onError === "function") {
        onError(error);
      }
    }
  }
}
