import { LogWriter } from "drizzle-orm/logger";
import { format } from "sql-formatter";
import { singleton } from "tsyringe";

import { ContextualLoggerService } from "@src/core/services/contextual-logger/contextual-logger.service";

@singleton()
export class PostgresLoggerService implements LogWriter {
  constructor(private readonly logger: ContextualLoggerService) {
    logger.setContext({ context: "POSTGRES" });
  }

  write(message: string) {
    let formatted = message.replace(/^Query: /, "");

    if (this.logger.isPretty) {
      formatted = format(message, { language: "postgresql" });
    }

    this.logger.debug(formatted);
  }
}
