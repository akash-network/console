import "reflect-metadata";
import "@akashnetwork/env-loader";
import "../providers/nodejs-process.provider";
import "../providers/k8s-client.provider";

import { container } from "tsyringe";

import { PROCESS } from "@src/providers/nodejs-process.provider";
import { K8sCollectorService } from "@src/services/k8s-collector/k8s-collector.service";
import { LoggerService } from "@src/services/logger/logger.service";

/**
 * Bootstraps the log and event collector application
 *
 * Initializes the application by:
 * 1. Setting up the logger context
 * 2. Starting the Kubernetes collector service (logs and events per pod)
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
  const nodeProcess = c.resolve<NodeJS.Process>(PROCESS);

  nodeProcess.on("unhandledRejection", (error: unknown) => {
    loggerService.error({ event: "UNHANDLED_REJECTION", error });
    nodeProcess.exit(1);
  });

  try {
    await c.resolve(K8sCollectorService).start();
  } catch (error) {
    loggerService.error({ error });
    nodeProcess.exit(1);
  }
};
