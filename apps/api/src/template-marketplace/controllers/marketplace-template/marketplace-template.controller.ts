import { singleton } from "tsyringe";

import type {
  GetUserTemplateResponse,
  GetUserTemplateVersionResponse,
  ListUserTemplateVersionsResponse,
  TemplateVersionSummaryResponse
} from "@src/template-marketplace/http-schemas/marketplace-template.schema";
import type {
  CreateUserTemplateRequest,
  CreateUserTemplateResponse,
  CreateUserTemplateVersionRequest,
  CreateUserTemplateVersionResponse,
  ListUserTemplatesQuery,
  ListUserTemplatesResponse,
  UpdateUserTemplateRequest,
  UpdateUserTemplateResponse
} from "@src/template-marketplace/http-schemas/template-writes.schema";
import {
  type ListedTemplateVersion,
  type MarketplaceTemplateOutput,
  MarketplaceTemplateService,
  type PublishedTemplateVersion,
  type UserTemplateListItem
} from "@src/template-marketplace/services/marketplace-template/marketplace-template.service";
import { TemplateWriterService } from "@src/template-marketplace/services/template-writer/template-writer.service";

function toVersionSummaryResponse({ createdById: _createdById, createdAt, ...version }: ListedTemplateVersion): TemplateVersionSummaryResponse {
  return { ...version, createdAt: createdAt.toISOString() };
}

function toVersionResponse({ createdById: _createdById, createdAt, ...version }: PublishedTemplateVersion): GetUserTemplateVersionResponse["data"] {
  return { ...version, createdAt: createdAt.toISOString() };
}

function toTemplateResponse({ createdAt, updatedAt, currentVersion, usage, ...template }: MarketplaceTemplateOutput): GetUserTemplateResponse["data"] {
  return {
    ...template,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
    currentVersion: currentVersion && toVersionResponse(currentVersion),
    usage: { ...usage, lastDeployedAt: usage.lastDeployedAt?.toISOString() ?? null }
  };
}

function toListItemResponse({ updatedAt, currentVersion, usage, ...item }: UserTemplateListItem): ListUserTemplatesResponse["data"][number] {
  return {
    ...item,
    updatedAt: updatedAt.toISOString(),
    currentVersion: currentVersion && { ...currentVersion, createdAt: currentVersion.createdAt.toISOString() },
    usage: { ...usage, lastDeployedAt: usage.lastDeployedAt?.toISOString() ?? null }
  };
}

@singleton()
export class MarketplaceTemplateController {
  constructor(
    private readonly marketplaceTemplateService: MarketplaceTemplateService,
    private readonly templateWriterService: TemplateWriterService
  ) {}

  async getTemplate(id: string): Promise<GetUserTemplateResponse> {
    return { data: toTemplateResponse(await this.marketplaceTemplateService.getTemplate(id)) };
  }

  async createTemplate({ data }: CreateUserTemplateRequest): Promise<CreateUserTemplateResponse> {
    return { data: toTemplateResponse(await this.templateWriterService.create(data)) };
  }

  async listTemplates(query: ListUserTemplatesQuery): Promise<ListUserTemplatesResponse> {
    const items = await this.marketplaceTemplateService.listInOrganization(query);

    return { data: items.map(toListItemResponse) };
  }

  async updateTemplate(id: string, { data }: UpdateUserTemplateRequest): Promise<UpdateUserTemplateResponse> {
    return { data: toTemplateResponse(await this.templateWriterService.updateSettings(id, data)) };
  }

  async deleteTemplate(id: string): Promise<void> {
    await this.templateWriterService.delete(id);
  }

  async createVersion(id: string, { data }: CreateUserTemplateVersionRequest): Promise<CreateUserTemplateVersionResponse> {
    return { data: toVersionResponse(await this.templateWriterService.appendVersion(id, data)) };
  }

  async listVersions(id: string): Promise<ListUserTemplateVersionsResponse> {
    const versions = await this.marketplaceTemplateService.listVersions(id);

    return { data: versions.map(toVersionSummaryResponse) };
  }

  async getVersion(id: string, version: number): Promise<GetUserTemplateVersionResponse> {
    return { data: toVersionResponse(await this.marketplaceTemplateService.getVersion(id, version)) };
  }
}
