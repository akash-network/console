import "reflect-metadata";

import { container } from "tsyringe";
import { afterAll } from "vitest";

afterAll(async () => {
  try {
    await container.dispose();
  } catch {
    // could be disposed in tests
  }
});
