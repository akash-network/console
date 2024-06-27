import { Bindings } from "pino";
import { injectable } from "tsyringe";

import { LoggerService } from "@src/core/services/logger/logger.service";
import { RequestStorageService } from "@src/core/services/request-storage/request-storage.service";

@injectable()
export class ContextualLoggerService extends LoggerService {
  constructor(private readonly requestStorage: RequestStorageService) {
    super();
  }

  setContext(bindings: Bindings) {
    this.pino = this.pino.child(bindings);
  }

  protected toLoggableInput(message: any) {
    const { context } = this.requestStorage;
    const requestId = context?.get("requestId");
    const loggableMessage = super.toLoggableInput(message);

    if (!requestId) {
      return loggableMessage;
    }

    if (typeof loggableMessage === "object" && !Array.isArray(loggableMessage)) {
      return { requestId, ...loggableMessage };
    }

    return { requestId, msg: loggableMessage };
  }
}
