import "reflect-metadata";

import { container } from "tsyringe";

afterAll(async () => {
  try {
    await container.dispose();
  } catch {
    // could be disposed in tests
  }
});
