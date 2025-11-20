import "./app";

import { Hono } from "hono";
import { container } from "tsyringe";

import { CORE_CONFIG, JobQueueService, LoggerService, startServer } from "@src/core";
import { healthzRouter } from "@src/healthz/routes/healthz.router";

export async function bootstrap(): Promise<void> {
  const app = new Hono();

  app.route("/", healthzRouter);

  const server = await startServer(app, LoggerService.forContext("BACKGROUND_JOBS"), process, { port: container.resolve(CORE_CONFIG).PORT });
  if (server) {
    await container.resolve(JobQueueService).startWorkers();
  }
}
