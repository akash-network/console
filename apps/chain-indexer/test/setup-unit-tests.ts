import { container } from "tsyringe";
import { afterAll } from "vitest";

afterAll(async () => {
  await container.dispose();
});
