import { vi } from "vitest";

vi.mock("@akashnetwork/logging", () => {
  class LoggerService {
    static forContext() {
      return new LoggerService();
    }

    error() {}
    debug() {}
    info() {}
  }

  vi.spyOn(LoggerService.prototype, "error");
  vi.spyOn(LoggerService.prototype, "debug");
  vi.spyOn(LoggerService.prototype, "info");

  return { LoggerService };
});
