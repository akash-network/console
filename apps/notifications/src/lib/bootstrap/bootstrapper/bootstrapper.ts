import "@akashnetwork/env-loader";

import type { INestApplication, Type } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { LoggerService } from "@src/common/services/logger/logger.service";
import { ShutdownService } from "@src/common/services/shutdown/shutdown.service";
import { HttpExceptionFilter } from "@src/interfaces/rest/filters/http-exception/http-exception.filter";

export class Bootstrapper {
  private app!: INestApplication;

  constructor(
    private readonly module: Type<any>,
    private readonly loggerService: LoggerService = new LoggerService(),
    private nestFactory: typeof NestFactory = NestFactory
  ) {
    loggerService.setContext(Bootstrapper.name);
  }

  async createApp() {
    this.app = await this.nestFactory.create(this.module, { logger: this.loggerService });
    this.app.enableShutdownHooks();
    const shutdownService = await this.app.resolve(ShutdownService);
    shutdownService.onShutdown(() => this.app.close());

    return this.app;
  }

  async startWorker() {
    this.assertApp();
    await this.app.init();
  }

  async configureHttp() {
    this.assertApp();
    this.app.enableVersioning();
    this.app.useGlobalFilters(new HttpExceptionFilter(await this.app.resolve(LoggerService)));
    this.app.enableCors();
  }

  async startHttp(port = process.env.PORT ?? 3000) {
    this.assertApp();
    await this.startWorker();
    await this.app.listen(port);

    this.loggerService.log(`Server started on port ${port}`);
  }

  private assertApp() {
    if (!this.app) {
      throw new Error("App not initialised");
    }
  }
}
