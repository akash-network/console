import { singleton } from "tsyringe";

import { Protected } from "@src/auth/services/auth.service";
import type {
  GpuWaitlistEntryOutput,
  GpuWaitlistEntryResponse,
  JoinGpuWaitlistRequest,
  ListGpuWaitlistResponse
} from "@src/gpu-waitlist/http-schemas/gpu-waitlist.schema";
import { type GpuWaitlistEntryInLine, GpuWaitlistService } from "@src/gpu-waitlist/services/gpu-waitlist/gpu-waitlist.service";

function toOutput(entry: GpuWaitlistEntryInLine): GpuWaitlistEntryOutput {
  const { id, vendor, model, memory, interface: gpuInterface, gpuCount, source, status, placeInLine, joinedAt, lastNotifiedAt } = entry;

  return {
    id,
    vendor,
    model,
    memory,
    interface: gpuInterface,
    gpuCount,
    source,
    status,
    placeInLine,
    joinedAt: joinedAt.toISOString(),
    lastNotifiedAt: lastNotifiedAt?.toISOString() ?? null
  };
}

@singleton()
export class GpuWaitlistController {
  constructor(private readonly gpuWaitlistService: GpuWaitlistService) {}

  @Protected([{ action: "create", subject: "GpuWaitlistEntry" }])
  async join(input: JoinGpuWaitlistRequest["data"]): Promise<GpuWaitlistEntryResponse> {
    return { data: toOutput(await this.gpuWaitlistService.join(input)) };
  }

  @Protected([{ action: "read", subject: "GpuWaitlistEntry" }])
  async list(): Promise<ListGpuWaitlistResponse> {
    return { data: (await this.gpuWaitlistService.list()).map(toOutput) };
  }

  @Protected([{ action: "update", subject: "GpuWaitlistEntry" }])
  async leave(id: string): Promise<void> {
    await this.gpuWaitlistService.leave(id);
  }

  @Protected([{ action: "update", subject: "GpuWaitlistEntry" }])
  async keep(id: string): Promise<GpuWaitlistEntryResponse> {
    return { data: toOutput(await this.gpuWaitlistService.keep(id)) };
  }
}
