import "reflect-metadata";
import "./open-telemetry";
import "./dotenv";

async function bootstrap() {
  /* eslint-disable @typescript-eslint/no-var-requires */
  console.log("Bootstrapping", process.env);
  if (process.env.BILLING_ENABLED === "true") {
    console.log("Billing enabled");
    const pg = require("./core");
    await pg.migratePG();
    console.log("PG Migrations complete");
  }

  const entry = require("./app");
  await entry.initApp();
}

bootstrap();
