import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type {
  HardwareRequestQueueFilters,
  HardwareRequestRepository,
  QueuedHardwareRequest
} from "@src/hardware-request/repositories/hardware-request/hardware-request.repository";
import { HardwareRequestBrokerService } from "./hardware-request-broker.service";

import { createHardwareRequest } from "@test/seeders/hardware-request.seeder";

describe(HardwareRequestBrokerService.name, () => {
  describe("listQueue", () => {
    it("reads the queue across organizations with the filters it is given", async () => {
      const { service, hardwareRequestRepository, queued } = setup();
      const filters: HardwareRequestQueueFilters = { lane: "sales", order: "oldest", limit: 10, offset: 20 };

      await expect(service.listQueue(filters)).resolves.toEqual([queued]);
      expect(hardwareRequestRepository.unscoped).toHaveBeenCalledWith("gpu-request-broker");
      expect(hardwareRequestRepository.findQueue).toHaveBeenCalledWith(filters);
    });
  });

  function setup() {
    const queued: QueuedHardwareRequest = { ...createHardwareRequest(), organizationName: "Acme", lastRepliedAt: null };
    const hardwareRequestRepository = mock<HardwareRequestRepository>();
    hardwareRequestRepository.unscoped.mockReturnValue(hardwareRequestRepository);
    hardwareRequestRepository.findQueue.mockResolvedValue([queued]);
    const service = new HardwareRequestBrokerService(hardwareRequestRepository);

    return { service, hardwareRequestRepository, queued };
  }
});
