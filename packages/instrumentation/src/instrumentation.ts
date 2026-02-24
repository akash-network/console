import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { NetInstrumentation } from "@opentelemetry/instrumentation-net";
import { PgInstrumentation } from "@opentelemetry/instrumentation-pg";
import { PinoInstrumentation } from "@opentelemetry/instrumentation-pino";
import { RuntimeNodeInstrumentation } from "@opentelemetry/instrumentation-runtime-node";
import { UndiciInstrumentation } from "@opentelemetry/instrumentation-undici";
import { containerDetector } from "@opentelemetry/resource-detector-container";
import { envDetector, hostDetector, processDetector } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";

export const sdk = new NodeSDK({
  instrumentations: [
    new RuntimeNodeInstrumentation({
      monitoringPrecision: 5000
    }),
    new HttpInstrumentation(),
    new PgInstrumentation(),
    new PinoInstrumentation({
      disableLogSending: true
    }),
    new NetInstrumentation(),
    new UndiciInstrumentation()
  ],
  resourceDetectors: [containerDetector, processDetector, envDetector, hostDetector]
});
