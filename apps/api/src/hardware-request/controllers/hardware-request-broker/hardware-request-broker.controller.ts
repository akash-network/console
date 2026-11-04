import { singleton } from "tsyringe";

import type { HardwareRequestQueueQuery, HardwareRequestQueueResponse } from "@src/hardware-request/http-schemas/hardware-request-broker.schema";
import { HardwareRequestBrokerService } from "@src/hardware-request/services/hardware-request-broker/hardware-request-broker.service";

@singleton()
export class HardwareRequestBrokerController {
  constructor(private readonly hardwareRequestBrokerService: HardwareRequestBrokerService) {}

  async listQueue(query: HardwareRequestQueueQuery): Promise<HardwareRequestQueueResponse> {
    return { data: await this.hardwareRequestBrokerService.listQueue(query) };
  }
}
