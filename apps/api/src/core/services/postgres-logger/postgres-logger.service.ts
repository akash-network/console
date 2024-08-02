import { LogWriter } from "drizzle-orm/logger";
import { format } from "sql-formatter";

import { LoggerService } from "@src/core/services/logger/logger.service";

export class PostgresLoggerService implements LogWriter {
  private readonly logger: LoggerService;

  private readonly isDrizzle: boolean;

  constructor(options?: { orm: "drizzle" | "sequelize" }) {
    const orm = options?.orm || "drizzle";
    this.logger = new LoggerService({ context: "POSTGRES", orm });
    this.isDrizzle = orm === "drizzle";
  }

  write(message: string) {
    let formatted = message.replace(this.isDrizzle ? /^Query: / : /^Executing \(default\):/, "");

    if (this.logger.isPretty) {
      formatted = format(formatted, { language: "postgresql" });
    }

    this.logger.debug(formatted);
  }
}
