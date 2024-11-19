import "reflect-metadata";
import "@akashnetwork/env-loader";
import "./open-telemetry";

import { initApp } from "./app";
import { migratePG } from "./core";

async function bootstrap() {
  await migratePG();
  await initApp();
}

bootstrap();
