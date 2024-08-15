import "reflect-metadata";

import dotenv from "dotenv";

import { closeConnections, migratePG } from "@src/core";

dotenv.config({ path: "env/.env.functional.test" });

beforeAll(async () => {
  await migratePG();
});

afterAll(async () => {
  await closeConnections();
});
