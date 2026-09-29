import { singleton } from "tsyringe";

import { Protected } from "@src/auth/services/auth.service";
import type { CreateHardwareRequestRequest, CreateHardwareRequestResponse } from "@src/hardware-request/http-schemas/hardware-request.schema";
import { HardwareRequestService } from "@src/hardware-request/services/hardware-request/hardware-request.service";

@singleton()
export class HardwareRequestController {
  constructor(private readonly hardwareRequestService: HardwareRequestService) {}

  @Protected([{ action: "create", subject: "HardwareRequest" }])
  async create(input: CreateHardwareRequestRequest["data"]): Promise<CreateHardwareRequestResponse> {
    const { id, createdAt } = await this.hardwareRequestService.create(input);
    return { data: { id, createdAt } };
  }
}
