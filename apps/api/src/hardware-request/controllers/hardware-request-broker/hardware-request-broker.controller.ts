import { singleton } from "tsyringe";

import type {
  AddHardwareRequestNoteRequest,
  AssignHardwareRequestOwnerRequest,
  ChangeHardwareRequestStatusRequest,
  CreateHardwareRequestOnBehalfRequest,
  HardwareRequestOfferActionRequest,
  HardwareRequestOfferDraftRequest,
  HardwareRequestOfferResponse,
  HardwareRequestQueueQuery,
  HardwareRequestQueueResponse,
  HardwareRequestWithTimelineResponse,
  SwitchHardwareRequestLaneRequest
} from "@src/hardware-request/http-schemas/hardware-request-broker.schema";
import { HardwareRequestService } from "@src/hardware-request/services/hardware-request/hardware-request.service";
import { HardwareRequestBrokerService } from "@src/hardware-request/services/hardware-request-broker/hardware-request-broker.service";
import { HardwareRequestOfferBrokerService } from "@src/hardware-request/services/hardware-request-offer-broker/hardware-request-offer-broker.service";

@singleton()
export class HardwareRequestBrokerController {
  constructor(
    private readonly hardwareRequestBrokerService: HardwareRequestBrokerService,
    private readonly hardwareRequestService: HardwareRequestService,
    private readonly hardwareRequestOfferBrokerService: HardwareRequestOfferBrokerService
  ) {}

  async createOnBehalf({ data }: CreateHardwareRequestOnBehalfRequest): Promise<HardwareRequestWithTimelineResponse> {
    const { id } = await this.hardwareRequestService.createOnBehalf(data);

    return { data: await this.hardwareRequestBrokerService.getWithTimeline(id) };
  }

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

  async changeStatus(id: string, { data }: ChangeHardwareRequestStatusRequest): Promise<HardwareRequestWithTimelineResponse> {
    return { data: await this.hardwareRequestBrokerService.changeStatus(id, data) };
  }

  async createOffer(id: string, { data }: HardwareRequestOfferDraftRequest): Promise<HardwareRequestOfferResponse> {
    return { data: await this.hardwareRequestOfferBrokerService.create(id, data) };
  }

  async updateOffer(id: string, offerId: string, { data }: HardwareRequestOfferDraftRequest): Promise<HardwareRequestOfferResponse> {
    return { data: await this.hardwareRequestOfferBrokerService.update(id, offerId, data) };
  }

  async publishOffer(id: string, offerId: string, { data }: HardwareRequestOfferActionRequest): Promise<HardwareRequestOfferResponse> {
    return { data: await this.hardwareRequestOfferBrokerService.publish(id, offerId, data) };
  }

  async withdrawOffer(id: string, offerId: string, { data }: HardwareRequestOfferActionRequest): Promise<HardwareRequestOfferResponse> {
    return { data: await this.hardwareRequestOfferBrokerService.withdraw(id, offerId, data) };
  }

  async addNote(id: string, { data }: AddHardwareRequestNoteRequest): Promise<HardwareRequestWithTimelineResponse> {
    return { data: await this.hardwareRequestBrokerService.addNote(id, data) };
  }
}
