import "reflect-metadata";

import { closeConnections, migratePG } from "@src/core";

beforeAll(async () => {
  await migratePG();
});

afterAll(async () => {
  await closeConnections();
});
