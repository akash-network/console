import { createHash } from "crypto";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { OrganizationMemberRepository } from "@src/organization/repositories/organization-member/organization-member.repository";
import type { TemplateViewKind } from "@src/template-marketplace/model-schemas/template-view-event/template-view-event.schema";
import { TemplateViewEventRepository } from "@src/template-marketplace/repositories/template-view-event/template-view-event.repository";
import { MarketplaceTemplateService } from "@src/template-marketplace/services/marketplace-template/marketplace-template.service";

@singleton()
export class TemplateViewService {
  constructor(
    private readonly marketplaceTemplateService: MarketplaceTemplateService,
    private readonly templateViewEventRepository: TemplateViewEventRepository,
    private readonly organizationMemberRepository: OrganizationMemberRepository,
    private readonly authService: AuthService,
    private readonly coreConfig: CoreConfigService
  ) {}

  /** Counts a signed-in viewer once a day, and never a member of the organization that publishes a public template, which cannot raise its own numbers. */
  async recordView(templateId: string, kind: TemplateViewKind, now = new Date()): Promise<void> {
    const template = await this.marketplaceTemplateService.findReadable(templateId);
    const userId = this.authService.currentUser.id;

    if (template.visibility === "public" && (await this.#belongsToPublisher(template.organizationId, userId))) return;

    const viewedOn = now.toISOString().slice(0, 10);

    await this.templateViewEventRepository.recordOncePerDay({
      templateId: template.id,
      kind,
      viewerKey: createHash("sha256").update(`${viewedOn}:${userId}`).digest("hex"),
      network: this.coreConfig.get("NETWORK"),
      viewedOn
    });
  }

  async #belongsToPublisher(organizationId: string, userId: string): Promise<boolean> {
    return !!(await this.organizationMemberRepository.unscoped("template-view-counting").findWithUserByUserId(organizationId, userId));
  }
}
