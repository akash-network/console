import { LogWriter } from "drizzle-orm/logger";
import { format } from "sql-formatter";

import { LoggerService } from "@src/core/services/logger/logger.service";

interface PostgresLoggerServiceOptions {
  orm?: "drizzle" | "sequelize";
  useFormat?: boolean;
}

export class PostgresLoggerService implements LogWriter {
  private readonly logger: LoggerService;

  private readonly isDrizzle: boolean;

  private readonly useFormat: boolean;

  constructor(options?: PostgresLoggerServiceOptions) {
    const orm = options?.orm || "drizzle";
    this.logger = new LoggerService({ context: "POSTGRES", orm });
    this.isDrizzle = orm === "drizzle";
    this.useFormat = options?.useFormat || false;
  }

  write(message: string) {
    let formatted = message.replace(this.isDrizzle ? /^Query: / : /^Executing \(default\):/, "");

    if (this.useFormat) {
      formatted = format(formatted, { language: "postgresql" });
    }

    this.logger.debug(formatted);
  }
}
