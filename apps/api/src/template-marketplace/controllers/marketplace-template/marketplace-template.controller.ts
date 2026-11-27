import { singleton } from "tsyringe";

import type {
  GetUserTemplateResponse,
  GetUserTemplateVersionResponse,
  ListUserTemplateVersionsResponse,
  TemplateVersionSummaryResponse
} from "@src/template-marketplace/http-schemas/marketplace-template.schema";
import type {
  CreateTemplateViewRequest,
  GetTemplateInsightsQuery,
  GetTemplateInsightsResponse
} from "@src/template-marketplace/http-schemas/template-insights.schema";
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
import type { InsightPeriodDays } from "@src/template-marketplace/lib/template-insights/template-insights";
import {
  type ListedTemplateVersion,
  type MarketplaceTemplateOutput,
  MarketplaceTemplateService,
  type PublishedTemplateVersion,
  type UserTemplateListItem
} from "@src/template-marketplace/services/marketplace-template/marketplace-template.service";
import { TemplateInsightsService } from "@src/template-marketplace/services/template-insights/template-insights.service";
import { TemplatePublishService } from "@src/template-marketplace/services/template-publish/template-publish.service";
import { TemplateReportService } from "@src/template-marketplace/services/template-report/template-report.service";
import { TemplateViewService } from "@src/template-marketplace/services/template-view/template-view.service";
import { TemplateWriterService } from "@src/template-marketplace/services/template-writer/template-writer.service";

function toVersionSummaryResponse({ createdById: _createdById, createdAt, reviewedAt, ...version }: ListedTemplateVersion): TemplateVersionSummaryResponse {
  return { ...version, createdAt: createdAt.toISOString(), reviewedAt: reviewedAt?.toISOString() ?? null };
}

function toVersionResponse({ createdById: _createdById, createdAt, reviewedAt, ...version }: PublishedTemplateVersion): GetUserTemplateVersionResponse["data"] {
  return { ...version, createdAt: createdAt.toISOString(), reviewedAt: reviewedAt?.toISOString() ?? null };
}

function toTemplateResponse({
  createdAt,
  updatedAt,
  publishedAt,
  currentVersion,
  publisher,
  usage,
  ...template
}: MarketplaceTemplateOutput): GetUserTemplateResponse["data"] {
  return {
    ...template,
    publisher: publisher && { ...publisher, memberSince: publisher.memberSince?.toISOString() ?? null },
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
    publishedAt: publishedAt?.toISOString() ?? null,
    currentVersion: currentVersion && toVersionResponse(currentVersion),
    usage: { ...usage, lastDeployedAt: usage.lastDeployedAt?.toISOString() ?? null }
  };
}

function toListItemResponse({ updatedAt, publishedAt, currentVersion, usage, ...item }: UserTemplateListItem): ListUserTemplatesResponse["data"][number] {
  return {
    ...item,
    updatedAt: updatedAt.toISOString(),
    publishedAt: publishedAt?.toISOString() ?? null,
    currentVersion: currentVersion && { ...currentVersion, createdAt: currentVersion.createdAt.toISOString() },
    usage: { ...usage, lastDeployedAt: usage.lastDeployedAt?.toISOString() ?? null }
  };
}

const INSIGHT_PERIOD_OF_QUERY = { "7": 7, "30": 30, "90": 90 } satisfies Record<GetTemplateInsightsQuery["days"], InsightPeriodDays>;

@singleton()
export class MarketplaceTemplateController {
  constructor(
    private readonly marketplaceTemplateService: MarketplaceTemplateService,
    private readonly templateWriterService: TemplateWriterService,
    private readonly templatePublishService: TemplatePublishService,
    private readonly templateReportService: TemplateReportService,
    private readonly templateViewService: TemplateViewService,
    private readonly templateInsightsService: TemplateInsightsService
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

  async recordView(id: string, { data }: CreateTemplateViewRequest): Promise<void> {
    await this.templateViewService.recordView(id, data.kind);
  }

  async getInsights(id: string, { days }: GetTemplateInsightsQuery): Promise<GetTemplateInsightsResponse> {
    return { data: await this.templateInsightsService.getInsights(id, INSIGHT_PERIOD_OF_QUERY[days]) };
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
