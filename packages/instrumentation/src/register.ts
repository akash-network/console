import { diag, DiagConsoleLogger } from "@opentelemetry/api";
import { diagLogLevelFromString, getStringFromEnv } from "@opentelemetry/core";
import process from "node:process";

import { sdk } from "./instrumentation";

const logLevel = getStringFromEnv("OTEL_LOG_LEVEL") || undefined;
if (logLevel !== undefined) {
  diag.setLogger(new DiagConsoleLogger(), {
    logLevel: diagLogLevelFromString(logLevel),
    suppressOverrideMessage: true
  });
}

diag.info("Starting OpenTelemetry SDK");
sdk.start();

const shutdown = async () => {
  try {
    await sdk.shutdown();
    diag.debug("OpenTelemetry SDK terminated");
  } catch (error) {
    diag.error("Error terminating OpenTelemetry SDK", error);
  }
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
