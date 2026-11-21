import { singleton } from "tsyringe";

import {
  findRiskyVersionChanges,
  OFFICIAL_TEMPLATE_HOLD_REASON,
  type TemplateVersionHoldReason
} from "@src/template-marketplace/lib/version-hold/version-hold-reasons";
import { InjectTemplateMarketplaceConfig, type TemplateMarketplaceConfig } from "@src/template-marketplace/providers/config.provider";
import { TemplateUsageEventRepository } from "@src/template-marketplace/repositories/template-usage-event/template-usage-event.repository";

export type HeldTemplate = { id: string; organizationId: string; isOfficial: boolean };

@singleton()
export class TemplateVersionHoldService {
  constructor(
    private readonly templateUsageEventRepository: TemplateUsageEventRepository,
    @InjectTemplateMarketplaceConfig() private readonly config: TemplateMarketplaceConfig
  ) {}

  /** Answers why a new version of a public template must wait for staff, and nothing for one that may go live: every version of an Official template waits, and so does a risky change to a popular one. */
  async findHoldReasons(template: HeldTemplate, currentSdl: string, nextSdl: string): Promise<TemplateVersionHoldReason[]> {
    const riskyChanges = findRiskyVersionChanges(currentSdl, nextSdl);

    if (template.isOfficial) return [OFFICIAL_TEMPLATE_HOLD_REASON, ...riskyChanges];
    if (riskyChanges.length === 0) return [];

    const weeklyDeployers = await this.templateUsageEventRepository.countWeeklyDeployers(template.id, template.organizationId);

    return weeklyDeployers >= this.config.TEMPLATE_POPULAR_WEEKLY_DEPLOYERS ? riskyChanges : [];
  }
}
