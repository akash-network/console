import { HttpLoggerInterceptor } from "@akashnetwork/logging/hono";
import { createOtelLogger } from "@akashnetwork/logging/otel";
import { Hono } from "hono";
import { container } from "tsyringe";

import { TakeBalanceSnapshotHandler } from "@src/billing/services/balance-snapshot/take-balance-snapshot.handler";
import { CORE_CONFIG, JobQueueService, migratePG, startServer } from "@src/core";
import { WatchGpuWaitlistsHandler } from "@src/gpu-waitlist/services/watch-gpu-waitlists/watch-gpu-waitlists.handler";
import { healthzRouter } from "@src/healthz/routes/healthz.router";
import { RecomputeTemplateScoresHandler } from "@src/template-marketplace/services/recompute-template-scores/recompute-template-scores.handler";
import { SendTemplatePublisherDigestHandler } from "@src/template-marketplace/services/send-template-publisher-digest/send-template-publisher-digest.handler";
import { WatchPopularTemplateImagesHandler } from "@src/template-marketplace/services/watch-popular-template-images/watch-popular-template-images.handler";
import { DailySignupSummaryHandler } from "@src/workload-abuse/services/daily-signup-summary/daily-signup-summary.handler";
import { RequestContextInterceptor } from "./core/services/request-context-interceptor/request-context.interceptor";

export async function bootstrap(): Promise<void> {
  const app = new Hono();

  app.use(container.resolve(HttpLoggerInterceptor).intercept());
  app.use(container.resolve(RequestContextInterceptor).intercept());
  app.route("/", healthzRouter);

  const server = await startServer(app, createOtelLogger({ context: "BACKGROUND_JOBS" }), process, {
    port: container.resolve(CORE_CONFIG).PORT,
    beforeStart: migratePG,
    beforeDispose: () => container.resolve(JobQueueService).dispose()
  });
  if (server) {
    await container.resolve(JobQueueService).startWorkers();
    await container.resolve(DailySignupSummaryHandler).seedNextRun(new Date());
    await container.resolve(WatchGpuWaitlistsHandler).seedNextRun();
    await container.resolve(WatchPopularTemplateImagesHandler).seedNextRun(new Date());
    await container.resolve(RecomputeTemplateScoresHandler).seedNextRun(new Date());
    await container.resolve(SendTemplatePublisherDigestHandler).seedNextRun(new Date());
    await container.resolve(TakeBalanceSnapshotHandler).seedNextRun(new Date());
  }
}
