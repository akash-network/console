import "./app";

import { createOtelLogger } from "@akashnetwork/logging/otel";
import { Hono } from "hono";
import { container } from "tsyringe";

import { CORE_CONFIG, JobQueueService, startServer } from "@src/core";
import { healthzRouter } from "@src/healthz/routes/healthz.router";

export async function bootstrap(): Promise<void> {
  const app = new Hono();

  app.route("/", healthzRouter);

  const server = await startServer(app, createOtelLogger({ context: "BACKGROUND_JOBS" }), process, { port: container.resolve(CORE_CONFIG).PORT });
  if (server) {
    await container.resolve(JobQueueService).startWorkers();
  }
}
