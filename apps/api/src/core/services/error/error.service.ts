import { inject, singleton } from "tsyringe";

import { type CreateLogger, LOGGER_FACTORY } from "../../providers/logging.provider";

@singleton()
export class ErrorService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(@inject(LOGGER_FACTORY) createLogger: CreateLogger) {
    this.logger = createLogger({ context: ErrorService.name });
  }

  async execWithErrorHandler<T>(extraLog: Record<string, unknown>, cb: () => Promise<T>, onError?: (error: unknown) => void): Promise<T | undefined> {
    try {
      return await cb();
    } catch (error) {
      this.logger.error({ error, ...extraLog });

      if (typeof onError === "function") {
        onError(error);
      }
    }
  }
}
