import "@akashnetwork/env-loader";

import type { Logger as LoggerBase } from "@akashnetwork/logging";
import type { INestApplication, Type } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { Logger } from "@src/common/providers/logger.provider";
import { ShutdownService } from "@src/common/services/shutdown/shutdown.service";
import { HttpExceptionFilter } from "@src/interfaces/rest/filters/http-exception/http-exception.filter";
import { HttpResultInterceptor } from "@src/interfaces/rest/interceptors/http-result/http-result.interceptor";

export async function bootstrapHandler(
  module: Type<any>,
  options?: {
    onBeforeInit?: (app: INestApplication) => void;
    logger?: LoggerBase;
    nestFactory?: typeof NestFactory;
  }
) {
  const logger = options?.logger || new Logger({ context: "BOOTSTRAP" });
  const nestFactory = options?.nestFactory || NestFactory;
  const app = await nestFactory.create(module, {
    logger
  });

  app.enableShutdownHooks();
  app.get(ShutdownService).onShutdown(() => app.close());

  if (options?.onBeforeInit) {
    options.onBeforeInit(app);
  }

  await app.init();
  logger.log(`Initialized app with ${module.name}`);

  return app;
}

export async function bootstrapHttp(module: Type<any>, options?: { logger?: LoggerBase; nestFactory?: typeof NestFactory }) {
  const logger = options?.logger || new Logger({ context: "BOOTSTRAP" });
  const app = await bootstrapHandler(module, {
    logger,
    nestFactory: options?.nestFactory,
    onBeforeInit: app => {
      app.enableVersioning();
      app.useGlobalInterceptors(new HttpResultInterceptor());
      app.useGlobalFilters(new HttpExceptionFilter());
    }
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`Server started on port ${port}`);
}
