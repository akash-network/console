import { vi } from "vitest";

import { TimerService } from "./timer.service";

describe(TimerService.name, () => {
  it("should resolve after the specified delay", async () => {
    vi.useFakeTimers();
    const { service } = setup();

    const callback = vi.fn();
    const promise = service.delay(1_000).then(callback);

    expect(callback).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1_000);
    await promise;

    expect(callback).toHaveBeenCalled();
    vi.useRealTimers();
  });

  function setup() {
    const service = new TimerService();
    return { service };
  }
});
