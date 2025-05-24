import { LoggerService } from "@akashnetwork/logging";
import { singleton } from "tsyringe";

@singleton()
export class ErrorService {
  private readonly logger = LoggerService.forContext(ErrorService.name);

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
