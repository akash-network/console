import "reflect-metadata";
import "./open-telemetry";

import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

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
