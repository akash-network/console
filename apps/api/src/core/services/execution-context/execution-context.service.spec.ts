import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core/providers/logging.provider";
import { ExecutionContextService } from "./execution-context.service";

describe(ExecutionContextService.name, () => {
  describe("onContextEnd", () => {
    it("runs the callback when the context ends", async () => {
      const { service } = setup();
      const onEnd = vi.fn();
      service.onContextEnd(onEnd);

      await service.runWithContext(async () => undefined);

      expect(onEnd).toHaveBeenCalledTimes(1);
    });

    it("runs the callback while the ending context can still be read", async () => {
      const { service } = setup();
      const heldAtEnd = vi.fn();
      service.onContextEnd(() => heldAtEnd(service.get("HELD_DATA_KEYS")));

      await service.runWithContext(async () => service.set("HELD_DATA_KEYS", new Map()));

      expect(heldAtEnd).toHaveBeenCalledWith(expect.any(Map));
    });

    it("runs the callback once for each context", async () => {
      const { service } = setup();
      const onEnd = vi.fn();
      service.onContextEnd(onEnd);

      await service.runWithContext(async () => undefined);
      await service.runWithContext(async () => undefined);

      expect(onEnd).toHaveBeenCalledTimes(2);
    });

    it("runs the callback for a context whose work threw", async () => {
      const { service } = setup();
      const onEnd = vi.fn();
      service.onContextEnd(onEnd);

      await expect(service.runWithContext(async () => Promise.reject(new Error("work failed")))).rejects.toThrow("work failed");

      expect(onEnd).toHaveBeenCalledTimes(1);
    });

    it("serves the work's result when a callback throws", async () => {
      const { service } = setup();
      service.onContextEnd(() => {
        throw new Error("measurement failed");
      });

      await expect(service.runWithContext(async () => "the work's own result")).resolves.toBe("the work's own result");
    });

    it("serves the work's error when a callback throws", async () => {
      const { service } = setup();
      service.onContextEnd(() => {
        throw new Error("measurement failed");
      });

      await expect(service.runWithContext(async () => Promise.reject(new Error("work failed")))).rejects.toThrow("work failed");
    });

    it("runs the callbacks that follow one that threw", async () => {
      const { service } = setup();
      const onEnd = vi.fn();
      service.onContextEnd(() => {
        throw new Error("measurement failed");
      });
      service.onContextEnd(onEnd);

      await service.runWithContext(async () => undefined);

      expect(onEnd).toHaveBeenCalledTimes(1);
    });

    it("reports a callback that threw rather than losing it", async () => {
      const { service, logger } = setup();
      service.onContextEnd(() => {
        throw new Error("measurement failed");
      });

      await service.runWithContext(async () => undefined);

      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "EXECUTION_CONTEXT_END_CALLBACK_FAILED" }));
    });
  });

  function setup() {
    const logger = mock<ReturnType<CreateLogger>>();
    const service = new ExecutionContextService(() => logger);

    return { service, logger };
  }
});
