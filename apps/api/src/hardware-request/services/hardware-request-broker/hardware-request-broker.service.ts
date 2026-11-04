import { singleton } from "tsyringe";

import {
  type HardwareRequestQueueFilters,
  HardwareRequestRepository,
  type QueuedHardwareRequest
} from "@src/hardware-request/repositories/hardware-request/hardware-request.repository";

/** Serves the team's broker queue, which sees every organization's requests. */
@singleton()
export class HardwareRequestBrokerService {
  constructor(private readonly hardwareRequestRepository: HardwareRequestRepository) {}

  async listQueue(filters: HardwareRequestQueueFilters): Promise<QueuedHardwareRequest[]> {
    return await this.hardwareRequestRepository.unscoped("gpu-request-broker").findQueue(filters);
  }
}
