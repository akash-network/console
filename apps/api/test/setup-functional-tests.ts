import "reflect-metadata";

import dotenv from "dotenv";

import { migratePG } from "@src/core";

dotenv.config({ path: ".env.functional.test" });

beforeAll(async () => {
  await migratePG();
});
