import { singleton } from "tsyringe";

import type {
  GetUserTemplateResponse,
  GetUserTemplateVersionResponse,
  ListUserTemplateVersionsResponse,
  TemplateVersionSummaryResponse
} from "@src/template-marketplace/http-schemas/marketplace-template.schema";
import type { TemplateVersionSummary } from "@src/template-marketplace/repositories/template-version/template-version.repository";
import {
  MarketplaceTemplateService,
  type PublishedTemplateVersion
} from "@src/template-marketplace/services/marketplace-template/marketplace-template.service";

function toVersionSummaryResponse(version: TemplateVersionSummary): TemplateVersionSummaryResponse {
  return { ...version, createdAt: version.createdAt.toISOString() };
}

function toVersionResponse(version: PublishedTemplateVersion): GetUserTemplateVersionResponse["data"] {
  return { ...version, createdAt: version.createdAt.toISOString() };
}

@singleton()
export class MarketplaceTemplateController {
  constructor(private readonly marketplaceTemplateService: MarketplaceTemplateService) {}

  async getTemplate(id: string): Promise<GetUserTemplateResponse> {
    const { createdAt, updatedAt, currentVersion, ...template } = await this.marketplaceTemplateService.getTemplate(id);

    return {
      data: {
        ...template,
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
        currentVersion: currentVersion && toVersionResponse(currentVersion)
      }
    };
  }

  async listVersions(id: string): Promise<ListUserTemplateVersionsResponse> {
    const versions = await this.marketplaceTemplateService.listVersions(id);

    return { data: versions.map(toVersionSummaryResponse) };
  }

  async getVersion(id: string, version: number): Promise<GetUserTemplateVersionResponse> {
    return { data: toVersionResponse(await this.marketplaceTemplateService.getVersion(id, version)) };
  }
}
