import { container } from "tsyringe";

afterAll(async () => {
  try {
    await container.dispose();
  } catch {
    // container may already be disposed in tests
  }
});
