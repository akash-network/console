import { singleton } from "tsyringe";

import {
  buildTemplateInsights,
  type InsightPeriodDays,
  insightWindowOf,
  type TemplateInsights
} from "@src/template-marketplace/lib/template-insights/template-insights";
import { SHOWN_NETWORK, TemplateUsageEventRepository } from "@src/template-marketplace/repositories/template-usage-event/template-usage-event.repository";
import { TemplateViewEventRepository } from "@src/template-marketplace/repositories/template-view-event/template-view-event.repository";
import { TemplateWriteAccessService } from "@src/template-marketplace/services/template-write-access/template-write-access.service";

@singleton()
export class TemplateInsightsService {
  constructor(
    private readonly templateWriteAccessService: TemplateWriteAccessService,
    private readonly templateUsageEventRepository: TemplateUsageEventRepository,
    private readonly templateViewEventRepository: TemplateViewEventRepository
  ) {}

  /** Shown to whoever may change the template, and counted as the public numbers are: on mainnet, without a public template's own organization. */
  async getInsights(templateId: string, days: InsightPeriodDays, now = new Date()): Promise<TemplateInsights> {
    const template = await this.templateWriteAccessService.findWritable(templateId, "update");
    const window = insightWindowOf(now, days);
    const since = window.previousFrom;
    const [views, deploys, forks, versions] = await Promise.all([
      this.templateViewEventRepository.countDailyViewers({ templateId: template.id, network: SHOWN_NETWORK, since }),
      this.templateUsageEventRepository.countDailyDeployCohorts(template.id, since),
      this.templateUsageEventRepository.countDailyForks(template.id, since),
      this.templateUsageEventRepository.countDeployCohortsByVersion(template.id)
    ]);

    return buildTemplateInsights(window, { views, deploys, forks, versions });
  }
}
