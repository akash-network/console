import { LoggerService } from "@akashnetwork/logging";
import { LogWriter } from "drizzle-orm/logger";
import { format } from "sql-formatter";

interface PostgresLoggerServiceOptions {
  orm?: "drizzle" | "sequelize";
  database?: string;
  useFormat?: boolean;
}

export class PostgresLoggerService implements LogWriter {
  private readonly logger: LoggerService;

  private readonly isDrizzle: boolean;

  private readonly useFormat: boolean;

  constructor(options?: PostgresLoggerServiceOptions) {
    const orm = options?.orm || "drizzle";
    this.logger = new LoggerService({ context: "POSTGRES", orm, database: options?.database });
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
