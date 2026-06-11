import type { LoggerService } from "@akashnetwork/logging";
import type { Logger } from "drizzle-orm";
import { format } from "sql-formatter";

import type { CreateLogger } from "../../types";

interface PostgresLoggerServiceOptions {
  orm?: "drizzle" | "sequelize";
  database?: string;
  useFormat?: boolean;
}

export class PostgresLoggerService implements Logger {
  readonly #logger: LoggerService;
  readonly #useFormat: boolean;

  constructor(createLogger: CreateLogger, options?: PostgresLoggerServiceOptions) {
    const orm = options?.orm ?? "drizzle";
    this.#logger = createLogger({ base: { context: "POSTGRES", orm, database: options?.database } });
    this.#useFormat = options?.useFormat || false;
  }

  logQuery(query: string, params: unknown[]): void {
    const stringifiedParams = [];
    for (const param of params) {
      stringifiedParams.push(stringifyParam(param));
    }
    let formatted = query;
    let isFormatted = false;
    if (this.#useFormat) {
      try {
        formatted = format(formatted, {
          language: "postgresql",
          paramTypes: {
            numbered: ["$"]
          },
          params: ["", ...stringifiedParams]
        });
        isFormatted = true;
      } catch {
        // do nothing if formatting fails, we still have the raw SQL
      }
    }

    if (!isFormatted) {
      formatted = `${formatted} -- params: ${stringifiedParams.join(", ")}`;
    }

    this.#logger.debug(formatted);
  }

  logNotice(message: unknown): void {
    this.#logger.warn(message);
  }
}

function stringifyParam(param: unknown): string {
  if (typeof param === "bigint") {
    return param.toString();
  }
  try {
    return JSON.stringify(param) ?? "null";
  } catch {
    return String(param);
  }
}
