import { container } from "tsyringe";
import { afterAll } from "vitest";

afterAll(async () => {
  try {
    await container.dispose();
  } catch {
    // container may already be disposed in tests
  }
});
