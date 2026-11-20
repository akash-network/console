import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { GpuSetupCheckRunRepository } from "./gpu-setup-check-run.repository";

describe(GpuSetupCheckRunRepository.name, () => {
  describe("countCreatedSince", () => {
    it("counts the runs created at or after the cutoff", async () => {
      const { repository, aRun } = setup();
      const cutoff = new Date("2026-11-18T00:00:00Z");
      const before = await repository.countCreatedSince(cutoff);
      await repository.create(aRun({ createdAt: new Date("2026-11-17T23:59:59Z") }));
      await repository.create(aRun({ createdAt: cutoff }));
      await repository.create(aRun({ createdAt: new Date("2026-11-18T10:00:00Z") }));

      expect(await repository.countCreatedSince(cutoff)).toBe(before + 2);
    });
  });

  function setup() {
    const repository = container.resolve(GpuSetupCheckRunRepository);
    const aRun = (overrides: { createdAt?: Date } = {}) => ({
      dseq: faker.string.numeric(12),
      setupCount: faker.number.int({ min: 1, max: 20 }),
      ...overrides
    });
    return { repository, aRun };
  }
});
