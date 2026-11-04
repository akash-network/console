import { singleton } from "tsyringe";

import { Protected } from "@src/auth/services/auth.service";
import type {
  CreateHardwareRequestRequest,
  CreateHardwareRequestResponse,
  ListHardwareRequestsResponse
} from "@src/hardware-request/http-schemas/hardware-request.schema";
import { HardwareRequestService } from "@src/hardware-request/services/hardware-request/hardware-request.service";

@singleton()
export class HardwareRequestController {
  constructor(private readonly hardwareRequestService: HardwareRequestService) {}

  @Protected([{ action: "create", subject: "HardwareRequest" }])
  async create(input: CreateHardwareRequestRequest["data"]): Promise<CreateHardwareRequestResponse> {
    const { id, createdAt, lane } = await this.hardwareRequestService.create(input);
    return { data: { id, createdAt, lane } };
  }

  @Protected([{ action: "read", subject: "HardwareRequest" }])
  async list(): Promise<ListHardwareRequestsResponse> {
    const hardwareRequests = await this.hardwareRequestService.list();
    return {
      data: hardwareRequests.map(
        ({ configuration: _configuration, lane: _lane, laneReason: _laneReason, estimatedMonthlyUsd: _estimatedMonthlyUsd, ...hardwareRequest }) =>
          hardwareRequest
      )
    };
  }
}
