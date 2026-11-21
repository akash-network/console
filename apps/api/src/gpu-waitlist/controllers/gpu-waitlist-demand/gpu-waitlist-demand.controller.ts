import { singleton } from "tsyringe";

import type { GpuWaitlistDemandResponse } from "@src/gpu-waitlist/http-schemas/gpu-waitlist.schema";
import { GpuWaitlistEntryRepository } from "@src/gpu-waitlist/repositories/gpu-waitlist-entry/gpu-waitlist-entry.repository";

@singleton()
export class GpuWaitlistDemandController {
  constructor(private readonly gpuWaitlistEntryRepository: GpuWaitlistEntryRepository) {}

  async getDemand(): Promise<GpuWaitlistDemandResponse> {
    const rows = await this.gpuWaitlistEntryRepository.countWaitingBySetupAcrossOrganizations();

    return {
      data: rows.map(({ vendor, model, memory, interface: gpuInterface, gpuCount, waiting, oldestJoinedAt }) => ({
        vendor,
        model,
        memory,
        interface: gpuInterface,
        gpuCount,
        waiting,
        oldestJoinedAt: oldestJoinedAt.toISOString()
      }))
    };
  }
}
