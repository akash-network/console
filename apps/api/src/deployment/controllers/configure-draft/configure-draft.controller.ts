import { singleton } from "tsyringe";

import { Protected } from "@src/auth/services/auth.service";
import type { ConfigureDraftContentInput, ConfigureDraftResponse } from "@src/deployment/http-schemas/configure-draft.schema";
import type { ConfigureDraftOutput } from "@src/deployment/repositories/configure-draft/configure-draft.repository";
import { ConfigureDraftService } from "@src/deployment/services/configure-draft/configure-draft.service";

@singleton()
export class ConfigureDraftController {
  constructor(private readonly configureDraftService: ConfigureDraftService) {}

  @Protected([{ action: "read", subject: "ConfigureDraft" }])
  async get(draftId: string): Promise<ConfigureDraftResponse> {
    return toConfigureDraftResponse(await this.configureDraftService.get(draftId));
  }

  @Protected([{ action: "create", subject: "ConfigureDraft" }])
  async save(draftId: string, content: ConfigureDraftContentInput): Promise<ConfigureDraftResponse> {
    return toConfigureDraftResponse(await this.configureDraftService.save(draftId, content));
  }

  @Protected([{ action: "delete", subject: "ConfigureDraft" }])
  async delete(draftId: string): Promise<void> {
    await this.configureDraftService.delete(draftId);
  }
}

function toConfigureDraftResponse({ draftId, content, updatedAt }: ConfigureDraftOutput): ConfigureDraftResponse {
  return { data: { ...content, draftId, updatedAt: updatedAt.toISOString() } };
}
