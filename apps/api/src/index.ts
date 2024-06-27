import "reflect-metadata";

import { container } from "tsyringe";

import { initApp } from "@src/app";
import { PostgresMigratorService } from "@src/core";

container
  .resolve(PostgresMigratorService)
  .migrate()
  .then(() => initApp());
