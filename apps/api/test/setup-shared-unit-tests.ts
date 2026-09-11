import "reflect-metadata";

import { afterAll, vi } from "vitest";

afterAll(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
