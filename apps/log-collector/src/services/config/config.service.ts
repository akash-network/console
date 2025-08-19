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
    LOG_MAX_FILE_SIZE_BYTES: z
      .number({ coerce: true })
      .optional()
      .default(10 * 1024 * 1024),
    LOG_MAX_ROTATED_FILES: z.number({ coerce: true }).optional().default(5)
  });

  /** Validated and transformed environment configuration */
  private readonly envConfig: z.infer<typeof this.envSchema>;

  /** Static configuration values that don't come from environment variables */
  private readonly staticConfig = {
    LOG_DIR: "./log"
  };

  /** Combined configuration type for both environment and static configs */
  private readonly combinedConfig: typeof this.envConfig & typeof this.staticConfig;

  /**
   * Creates a new ConfigService instance
   *
   * @param env - Node.js environment variables to validate and use
   */
  constructor(@inject(PROCESS_ENV) private readonly env: NodeJS.ProcessEnv) {
    this.envConfig = this.envSchema.parse(env);
    this.combinedConfig = { ...this.envConfig, ...this.staticConfig };
  }

  /**
   * Gets a configuration value by key
   *
   * @param key - The configuration key to retrieve
   * @returns The configuration value with proper typing
   */
  get<K extends keyof typeof this.combinedConfig>(key: K): (typeof this.combinedConfig)[K] {
    return this.combinedConfig[key];
  }
}
