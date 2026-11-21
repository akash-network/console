import { singleton } from "tsyringe";

import type { AskedValue } from "@src/template-marketplace/lib/asked-values/asked-values.schema";
import { findAskedValueIssues } from "@src/template-marketplace/lib/asked-values/find-asked-value-issues";
import type { PublishCheckResults } from "@src/template-marketplace/lib/publish-checks/publish-check-results";
import { runPublishChecks } from "@src/template-marketplace/lib/publish-checks/publish-checks";
import { TemplatePublisherRepository } from "@src/template-marketplace/repositories/template-publisher/template-publisher.repository";
import { TemplateSdlValidatorService } from "@src/template-marketplace/services/template-sdl-validator/template-sdl-validator.service";

export type PublishCheckSubject = { sdl: string; readme: string | null; askedValues: AskedValue[]; title: string; organizationId: string };

@singleton()
export class PublishChecksService {
  constructor(
    private readonly templateSdlValidatorService: TemplateSdlValidatorService,
    private readonly templatePublisherRepository: TemplatePublisherRepository
  ) {}

  /** Runs every check on the content given, read under the name its organization would publish it as. */
  async run({ sdl, readme, askedValues, title, organizationId }: PublishCheckSubject): Promise<PublishCheckResults> {
    const organization = await this.templatePublisherRepository.findPublishingOrganization(organizationId);
    const sdlIssues = this.templateSdlValidatorService.findIssues(sdl);

    return runPublishChecks({
      sdl,
      readme,
      askedValues,
      title,
      publisherName: organization?.name ?? null,
      sdlIssues: sdlIssues.length > 0 ? sdlIssues : findAskedValueIssues(sdl, askedValues),
      ranAt: new Date()
    });
  }
}
