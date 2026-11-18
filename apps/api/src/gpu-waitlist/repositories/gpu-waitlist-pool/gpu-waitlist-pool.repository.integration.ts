import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { TxService } from "@src/core/services";
import { GpuWaitlistPoolRepository } from "./gpu-waitlist-pool.repository";

describe(GpuWaitlistPoolRepository.name, () => {
  describe("upsert", () => {
    it("creates the pool and then overwrites its supply without touching the wave", async () => {
      const { repository, poolKey } = setup();

      await repository.upsert({ poolKey, lastFreeUnits: 8, lastMaxNodeFreeUnits: 8 });
      await repository.update(poolKey, { waveNumber: 2 });
      await repository.upsert({ poolKey, lastFreeUnits: 3, lastMaxNodeFreeUnits: 2 });

      expect(await repository.findByPoolKeyAndLock(poolKey)).toEqual(expect.objectContaining({ lastFreeUnits: 3, lastMaxNodeFreeUnits: 2, waveNumber: 2 }));
    });
  });

  describe("findByPoolKeyAndLock", () => {
    it("returns undefined for an unknown pool", async () => {
      const { repository, poolKey } = setup();

      expect(await repository.findByPoolKeyAndLock(poolKey)).toBeUndefined();
    });

    it("makes a second transaction wait until the first one commits", async () => {
      const { repository, poolKey } = setup();
      const txService = container.resolve(TxService);
      await repository.upsert({ poolKey, lastFreeUnits: 1, lastMaxNodeFreeUnits: 1 });
      const order: string[] = [];

      const first = txService.transaction(async () => {
        await repository.findByPoolKeyAndLock(poolKey);
        await new Promise(resolve => setTimeout(resolve, 200));
        order.push("first committed");
      });
      await new Promise(resolve => setTimeout(resolve, 50));
      const second = txService.transaction(async () => {
        await repository.findByPoolKeyAndLock(poolKey);
        order.push("second locked");
      });
      await Promise.all([first, second]);

      expect(order).toEqual(["first committed", "second locked"]);
    });
  });

  function setup() {
    return { repository: container.resolve(GpuWaitlistPoolRepository), poolKey: `pool-${faker.string.alphanumeric(16).toLowerCase()}` };
  }
});
