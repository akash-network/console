import "reflect-metadata";
import "@akashnetwork/env-loader";
import "./open-telemetry";

async function bootstrap() {
  /* eslint-disable @typescript-eslint/no-var-requires */
  if (process.env.BILLING_ENABLED === "true") {
    const pg = require("./core");
    await pg.migratePG();
  }

  const entry = require("./app");
  await entry.initApp();
}

bootstrap();
