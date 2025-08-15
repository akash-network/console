import { inject, singleton } from "tsyringe";
import { z } from "zod";

import { PROCESS_ENV } from "@src/providers/nodejs-process.provider";

/**
 * Service for managing application configuration
 *
 * Provides type-safe access to environment variables and configuration values.
 * Uses Zod schema validation to ensure required environment variables are present
 * and have the correct types.
 */
@singleton()
export class ConfigService {
  /** Schema for validating and transforming environment variables */
  private readonly envSchema = z.object({
    HOSTNAME: z.string(),
    KUBERNETES_NAMESPACE_OVERRIDE: z.string().optional(),
    LOG_DIR: z.string().optional().default("./log"),
    LOG_MAX_FILE_SIZE_BYTES: z
      .number({ coerce: true })
      .optional()
      .default(10 * 1024 * 1024),
    LOG_MAX_ROTATED_FILES: z.number({ coerce: true }).optional().default(5)
  });

  /** Validated and transformed environment configuration */
  private readonly envConfig: z.infer<typeof this.envSchema>;

  /**
   * Creates a new ConfigService instance
   *
   * @param env - Node.js environment variables to validate and use
   */
  constructor(@inject(PROCESS_ENV) private readonly env: NodeJS.ProcessEnv) {
    this.envConfig = this.envSchema.parse(env);
  }

  /**
   * Gets a configuration value by key
   *
   * @param key - The configuration key to retrieve
   * @returns The configuration value with proper typing
   */
  get<K extends keyof typeof this.envConfig>(key: K): (typeof this.envConfig)[K] {
    return this.envConfig[key];
  }
}
