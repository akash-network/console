import { ShutdownService } from "./shutdown.service";

describe(ShutdownService.name, () => {
  it("should call the registered shutdown function when shutdown is triggered", () => {
    const shutdownFn = jest.fn();
    const service = new ShutdownService();
    service.onShutdown(shutdownFn);
    service.shutdown();

    expect(shutdownFn).toHaveBeenCalledTimes(1);
  });

  it("should support multiple shutdown handlers", () => {
    const fn1 = jest.fn();
    const fn2 = jest.fn();
    const service = new ShutdownService();
    service.onShutdown(fn1);
    service.onShutdown(fn2);
    service.shutdown();

    expect(fn1).toHaveBeenCalled();
    expect(fn2).toHaveBeenCalled();
  });

  it("should not call the shutdown function if shutdown was not triggered", () => {
    const shutdownFn = jest.fn();
    const service = new ShutdownService();
    service.onShutdown(shutdownFn);

    expect(shutdownFn).not.toHaveBeenCalled();
  });
});
