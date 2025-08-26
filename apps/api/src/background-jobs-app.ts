import "./app";

import { Hono } from "hono";
import { container } from "tsyringe";

import { JobQueueService, LoggerService, startServer } from "@src/core";
import { healthzRouter } from "@src/healthz/routes/healthz.router";

export async function bootstrap(port: number): Promise<void> {
  const app = new Hono();

  app.route("/", healthzRouter);
  const server = await startServer(app, LoggerService.forContext("BACKGROUND_JOBS"), process, { port });
  if (server) {
    await container.resolve(JobQueueService).startWorkers();
  }
}
