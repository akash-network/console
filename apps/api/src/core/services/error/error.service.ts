import { singleton } from "tsyringe";

import { LoggerService } from "../../providers/logging.provider";

@singleton()
export class ErrorService {
  constructor(private readonly logger: LoggerService) {
    this.logger.setContext(ErrorService.name);
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
