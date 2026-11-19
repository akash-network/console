import { singleton } from "tsyringe";

import type {
  CommunityTemplateCardResponse,
  GetCurrentTemplatePublisherResponse,
  GetTemplatePublisherResponse,
  ListCommunityTemplatesResponse,
  UpdateCurrentTemplatePublisherRequest
} from "@src/template-marketplace/http-schemas/community-template.schema";
import { type CommunityTemplateCard, CommunityTemplateService } from "@src/template-marketplace/services/community-template/community-template.service";
import { type CurrentTemplatePublisher, TemplatePublisherService } from "@src/template-marketplace/services/template-publisher/template-publisher.service";

function toCardResponse({ publishedAt, updatedAt, ...card }: CommunityTemplateCard): CommunityTemplateCardResponse {
  return { ...card, publishedAt: publishedAt.toISOString(), updatedAt: updatedAt.toISOString() };
}

function toCurrentPublisherResponse({ memberSince, ...publisher }: CurrentTemplatePublisher): GetCurrentTemplatePublisherResponse["data"] {
  return { ...publisher, memberSince: memberSince.toISOString() };
}

@singleton()
export class CommunityTemplateController {
  constructor(
    private readonly communityTemplateService: CommunityTemplateService,
    private readonly templatePublisherService: TemplatePublisherService
  ) {}

  async listTemplates(): Promise<ListCommunityTemplatesResponse> {
    const { templates, officialUsage } = await this.communityTemplateService.getGallery();

    return { data: { templates: templates.map(toCardResponse), officialUsage } };
  }

  async getPublisher(handle: string): Promise<GetTemplatePublisherResponse> {
    const { memberSince, templates, ...publisher } = await this.templatePublisherService.getPage(handle);

    return { data: { ...publisher, memberSince: memberSince.toISOString(), templates: templates.map(toCardResponse) } };
  }

  async getCurrentPublisher(): Promise<GetCurrentTemplatePublisherResponse> {
    return { data: toCurrentPublisherResponse(await this.templatePublisherService.getCurrent()) };
  }

  async updateCurrentPublisher({ data }: UpdateCurrentTemplatePublisherRequest): Promise<GetCurrentTemplatePublisherResponse> {
    return { data: toCurrentPublisherResponse(await this.templatePublisherService.updateCurrent(data)) };
  }
}
