import "reflect-metadata";

import dotenv from "dotenv";
import { container } from "tsyringe";

import { PostgresMigratorService } from "@src/core";

dotenv.config({ path: ".env.functional.test" });

beforeAll(async () => {
  await container.resolve(PostgresMigratorService).migrate();
});
