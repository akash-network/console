import "reflect-metadata";
import "@akashnetwork/env-loader";
import "../providers/nodejs-process.provider";
import "../providers/k8s-client.provider";

import { container } from "tsyringe";

import { PROCESS } from "@src/providers/nodejs-process.provider";
import { K8sLogCollectorService } from "@src/services/k8s-log-collector/k8s-log-collector.service";
import { LoggerService } from "@src/services/logger/logger.service";

/**
 * Bootstraps the log collector application
 *
 * Initializes the application by:
 * 1. Setting up the logger context
 * 2. Starting the Kubernetes log collection service
 * 3. Handling any errors that occur during startup
 *
 * If an error occurs during startup, the application will:
 * - Log the error
 * - Exit the process with code 1
 *
 * @param c - The dependency injection container to use. Defaults to the global container.
 * @returns Promise that resolves when the application has started successfully
 */
export const bootstrap = async (c = container) => {
  const loggerService = c.resolve(LoggerService);
  loggerService.setContext("INIT");

  try {
    await c.resolve(K8sLogCollectorService).start();
  } catch (error) {
    loggerService.error({ error });
    c.resolve<NodeJS.Process>(PROCESS).exit(1);
  }
};
