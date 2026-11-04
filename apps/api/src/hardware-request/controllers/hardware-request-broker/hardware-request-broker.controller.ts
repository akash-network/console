import { singleton } from "tsyringe";

import type {
  AddHardwareRequestNoteRequest,
  AssignHardwareRequestOwnerRequest,
  HardwareRequestQueueQuery,
  HardwareRequestQueueResponse,
  HardwareRequestWithTimelineResponse,
  SwitchHardwareRequestLaneRequest
} from "@src/hardware-request/http-schemas/hardware-request-broker.schema";
import { HardwareRequestBrokerService } from "@src/hardware-request/services/hardware-request-broker/hardware-request-broker.service";

@singleton()
export class HardwareRequestBrokerController {
  constructor(private readonly hardwareRequestBrokerService: HardwareRequestBrokerService) {}

  async listQueue(query: HardwareRequestQueueQuery): Promise<HardwareRequestQueueResponse> {
    return { data: await this.hardwareRequestBrokerService.listQueue(query) };
  }

  async get(id: string): Promise<HardwareRequestWithTimelineResponse> {
    return { data: await this.hardwareRequestBrokerService.getWithTimeline(id) };
  }

  async assignOwner(id: string, { data }: AssignHardwareRequestOwnerRequest): Promise<HardwareRequestWithTimelineResponse> {
    return { data: await this.hardwareRequestBrokerService.assignOwner(id, data) };
  }

  async switchLane(id: string, { data }: SwitchHardwareRequestLaneRequest): Promise<HardwareRequestWithTimelineResponse> {
    return { data: await this.hardwareRequestBrokerService.switchLane(id, data) };
  }

  async addNote(id: string, { data }: AddHardwareRequestNoteRequest): Promise<HardwareRequestWithTimelineResponse> {
    return { data: await this.hardwareRequestBrokerService.addNote(id, data) };
  }
}
