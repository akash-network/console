import type { Type } from "@nestjs/common";

import { Bootstrapper } from "@src/lib/bootstrap/bootstrapper/bootstrapper";
import { SwaggerSetup } from "@src/lib/bootstrap/swagger-setup/swagger-setup";

export async function bootstrapHttp(module: Type<any>) {
  const bootstrapper = new Bootstrapper(module);
  const app = await bootstrapper.createApp();
  await bootstrapper.configureHttp();
  SwaggerSetup.serveSwagger(app);
  await bootstrapper.startHttp();
}

export async function bootstrapWorker(module: Type<any>) {
  const bootstrapper = new Bootstrapper(module);
  await bootstrapper.createApp();
  await bootstrapper.startWorker();
}

export const createHttpBootstrapper = (module: Type<any>) => () => bootstrapHttp(module);
export const createWorkerBootstrapper = (module: Type<any>) => () => bootstrapWorker(module);
