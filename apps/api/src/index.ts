import "reflect-metadata";
import "./open-telemetry";

import { container } from "tsyringe";

import { initApp } from "@src/app";
import type { PostgresMigratorService } from "@src/core";

const { BILLING_ENABLED } = process.env;

const migrate =
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  BILLING_ENABLED === "true" ? container.resolve<PostgresMigratorService>(require("@src/core").PostgresMigratorService).migrate() : Promise.resolve();

migrate.then(() => initApp());
