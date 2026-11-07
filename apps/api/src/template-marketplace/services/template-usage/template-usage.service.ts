import { inject, singleton } from "tsyringe";

import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import type { DeploymentSettingsOutput } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type { TemplateSource } from "@src/template-marketplace/model-schemas/template-usage-event/template-usage-event.schema";
import { TemplateUsageEventRepository } from "@src/template-marketplace/repositories/template-usage-event/template-usage-event.repository";

export type TemplateRef = { source: TemplateSource; templateRef: string; templateVersionId: string | null };

export type DeployedDefinition = Pick<DeploymentSettingsOutput, "id" | "userId" | "organizationId" | "dseq" | "templateId" | "templateVersionId">;

@singleton()
export class TemplateUsageService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly templateUsageEventRepository: TemplateUsageEventRepository,
    private readonly coreConfig: CoreConfigService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: TemplateUsageService.name });
  }

  /** Recording is invisible to the deployer, so a failure is only logged and never costs them the deploy. */
  async recordDeployed(definition: DeployedDefinition, wallet: { isTrialing?: boolean | null }): Promise<void> {
    try {
      const ref = await this.templateRefOf(definition);
      if (!ref) return;

      await this.templateUsageEventRepository.record({
        ...ref,
        action: "deploy",
        userId: definition.userId,
        organizationId: definition.organizationId,
        deploymentSettingId: definition.id,
        dseq: definition.dseq,
        network: this.coreConfig.get("NETWORK"),
        isTrial: !!wallet.isTrialing
      });
    } catch (error) {
      this.logger.error({ event: "TEMPLATE_USAGE_RECORD_FAILED", action: "deploy", deploymentSettingId: definition.id, dseq: definition.dseq, error });
    }
  }

  /** A version whose template was deleted names nothing left to count, so it gives no ref. */
  async templateRefOf(definition: Pick<DeploymentSettingsOutput, "templateId" | "templateVersionId">): Promise<TemplateRef | undefined> {
    if (definition.templateVersionId) {
      const templateId = await this.templateUsageEventRepository.findTemplateIdOfVersion(definition.templateVersionId);

      return templateId ? { source: "console", templateRef: templateId, templateVersionId: definition.templateVersionId } : undefined;
    }

    if (definition.templateId) return { source: "awesome_akash", templateRef: definition.templateId, templateVersionId: null };

    return undefined;
  }
}
