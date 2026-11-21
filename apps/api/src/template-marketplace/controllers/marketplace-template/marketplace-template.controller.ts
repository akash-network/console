import { singleton } from "tsyringe";

import type {
  GetUserTemplateResponse,
  GetUserTemplateVersionResponse,
  ListUserTemplateVersionsResponse,
  TemplateVersionSummaryResponse
} from "@src/template-marketplace/http-schemas/marketplace-template.schema";
import type {
  GetPublishReadinessResponse,
  PublishUserTemplateRequest,
  PublishUserTemplateResponse
} from "@src/template-marketplace/http-schemas/template-publish.schema";
import type { CreateTemplateReportRequest, CreateTemplateReportResponse } from "@src/template-marketplace/http-schemas/template-report.schema";
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
import { TemplatePublishService } from "@src/template-marketplace/services/template-publish/template-publish.service";
import { TemplateReportService } from "@src/template-marketplace/services/template-report/template-report.service";
import { TemplateWriterService } from "@src/template-marketplace/services/template-writer/template-writer.service";

function toVersionSummaryResponse({ createdById: _createdById, createdAt, ...version }: ListedTemplateVersion): TemplateVersionSummaryResponse {
  return { ...version, createdAt: createdAt.toISOString() };
}

function toVersionResponse({ createdById: _createdById, createdAt, ...version }: PublishedTemplateVersion): GetUserTemplateVersionResponse["data"] {
  return { ...version, createdAt: createdAt.toISOString() };
}

function toTemplateResponse({
  createdAt,
  updatedAt,
  publishedAt,
  currentVersion,
  usage,
  ...template
}: MarketplaceTemplateOutput): GetUserTemplateResponse["data"] {
  return {
    ...template,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
    publishedAt: publishedAt?.toISOString() ?? null,
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
    private readonly templateWriterService: TemplateWriterService,
    private readonly templatePublishService: TemplatePublishService,
    private readonly templateReportService: TemplateReportService
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

  async getPublishReadiness(id: string): Promise<GetPublishReadinessResponse> {
    return { data: await this.templatePublishService.getReadiness(id) };
  }

  async publishTemplate(id: string, { data }: PublishUserTemplateRequest): Promise<PublishUserTemplateResponse> {
    return { data: toTemplateResponse(await this.templatePublishService.publish(id, data.acceptedTermsVersion)) };
  }

  async reportTemplate(id: string, { data }: CreateTemplateReportRequest): Promise<CreateTemplateReportResponse> {
    const { createdAt, ...report } = await this.templateReportService.report(id, data);

    return { data: { ...report, createdAt: createdAt.toISOString() } };
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
