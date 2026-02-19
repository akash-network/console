import { vi } from "vitest";

// Temporary mock config because it validates env variables
// In future it will be removed, when all config references will be accessed via DI
vi.mock("@src/config/server-env.config", () => ({
  serverEnvConfig: {}
}));
