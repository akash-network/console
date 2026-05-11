import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DiscoverySchedulerService } from "@src/services/discovery-scheduler/discovery-scheduler.service";
import type { ProviderInventoryWriterService } from "@src/services/provider-inventory-writer/provider-inventory-writer.service";
import { runStreamerBootstrap } from "./streamer-bootstrap";

describe("runStreamerBootstrap", () => {
  it("calls writer.resetOnlineSince before scheduler.start", async () => {
    const { writer, scheduler } = setup();

    await runStreamerBootstrap(writer, scheduler);

    expect(writer.resetOnlineSince).toHaveBeenCalledTimes(1);
    expect(scheduler.start).toHaveBeenCalledTimes(1);
    expect(writer.resetOnlineSince.mock.invocationCallOrder[0]).toBeLessThan(scheduler.start.mock.invocationCallOrder[0]);
  });

  it("awaits resetOnlineSince before invoking scheduler.start", async () => {
    let resetResolved = false;
    const { writer, scheduler } = setup();
    writer.resetOnlineSince.mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 5));
      resetResolved = true;
    });
    scheduler.start.mockImplementation(() => {
      expect(resetResolved).toBe(true);
    });

    await runStreamerBootstrap(writer, scheduler);

    expect(scheduler.start).toHaveBeenCalledTimes(1);
  });

  it("propagates resetOnlineSince errors and skips scheduler.start", async () => {
    const { writer, scheduler } = setup();
    writer.resetOnlineSince.mockRejectedValueOnce(new Error("db down"));

    await expect(runStreamerBootstrap(writer, scheduler)).rejects.toThrow("db down");
    expect(scheduler.start).not.toHaveBeenCalled();
  });

  function setup() {
    const writer = mock<ProviderInventoryWriterService>();
    const scheduler = mock<DiscoverySchedulerService>();
    writer.resetOnlineSince.mockResolvedValue(undefined);
    return { writer, scheduler };
  }
});
