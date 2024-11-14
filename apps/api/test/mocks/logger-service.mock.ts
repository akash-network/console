jest.mock("@akashnetwork/logging", () => {
  class LoggerService {
    static forContext() {
      return new LoggerService();
    }

    error() {}
    debug() {}
    info() {}
  }

  jest.spyOn(LoggerService.prototype, "error");
  jest.spyOn(LoggerService.prototype, "debug");
  jest.spyOn(LoggerService.prototype, "info");

  return { LoggerService };
});
