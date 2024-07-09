import { LogWriter } from "drizzle-orm/logger";
import { format } from "sql-formatter";

import { LoggerService } from "@src/core/services/logger/logger.service";

export class PostgresLoggerService implements LogWriter {
  private readonly logger = new LoggerService({ context: "POSTGRES" });

  write(message: string) {
    let formatted = message.replace(/^Query: /, "");

    if (this.logger.isPretty) {
      formatted = format(message, { language: "postgresql" });
    }

    this.logger.debug(formatted);
  }
}
