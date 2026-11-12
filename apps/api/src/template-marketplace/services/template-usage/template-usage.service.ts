import { addHours } from "date-fns";
import { inject, singleton } from "tsyringe";

import { UserWalletRepository } from "@src/billing/repositories";
import { type CreateLogger, JobQueueService, LOGGER_FACTORY } from "@src/core";
import { TxService } from "@src/core/services";
import { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { DeploymentSettingRepository, type DeploymentSettingsOutput } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type { TemplateSource, TemplateUsageAction } from "@src/template-marketplace/model-schemas/template-usage-event/template-usage-event.schema";
import { TemplateUsageEventRepository } from "@src/template-marketplace/repositories/template-usage-event/template-usage-event.repository";
import {
  CheckTemplateDeploymentStillRunning,
  checkTemplateDeploymentStillRunningKeyFor
} from "@src/template-marketplace/services/check-template-deployment-still-running/check-template-deployment-still-running.job";

export type TemplateRef = { source: TemplateSource; templateRef: string; templateVersionId: string | null };

export type DeployedDefinition = Pick<DeploymentSettingsOutput, "id" | "userId" | "organizationId" | "dseq" | "templateId" | "templateVersionId">;

const STILL_RUNNING_CHECK_DELAY_HOURS = 24;

@singleton()
export class TemplateUsageService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly templateUsageEventRepository: TemplateUsageEventRepository,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    private readonly jobQueueService: JobQueueService,
    private readonly coreConfig: CoreConfigService,
    private readonly txService: TxService,
    private readonly executionContextService: ExecutionContextService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: TemplateUsageService.name });
  }

  async recordDeployed(definition: DeployedDefinition, wallet: { isTrialing?: boolean | null }): Promise<void> {
    await this.#recordSafely({ action: "deploy", deploymentSettingId: definition.id, dseq: definition.dseq }, async () => {
      await this.#recordFromTemplate("deploy", definition, { isTrial: !!wallet.isTrialing });
    });
  }

  /** Prefers the trial state the lease was signed with, since the wallet may have left its trial by the time this runs. */
  async recordLeaseCreated({
    walletId,
    dseq,
    leaseCreatedAt,
    wasTrialing
  }: {
    walletId: number;
    dseq: string;
    leaseCreatedAt: Date;
    wasTrialing?: boolean;
  }): Promise<void> {
    await this.#recordSafely({ action: "lease_created", walletId, dseq }, async () => {
      const wallet = await this.userWalletRepository.findOneBy({ id: walletId });
      if (!wallet) return;

      const setting = await this.deploymentSettingRepository.findOneOfWallet(wallet, dseq);
      const isTrial = wasTrialing ?? !!wallet.isTrialing;
      if (!setting || !(await this.#recordFromTemplate("lease_created", setting, { isTrial, createdAt: leaseCreatedAt }))) return;

      await this.jobQueueService.enqueue(new CheckTemplateDeploymentStillRunning({ deploymentSettingId: setting.id, walletId, dseq, isTrial }), {
        singletonKey: checkTemplateDeploymentStillRunningKeyFor(setting.id),
        startAfter: addHours(leaseCreatedAt, STILL_RUNNING_CHECK_DELAY_HOURS)
      });
    });
  }

  /** Throws, unlike the other recorders, so its job retries a failed insert; the deployment's unique index keeps a retry to one event. */
  async recordStillRunning({ deploymentSettingId, isTrial }: { deploymentSettingId: string; dseq: string; isTrial: boolean }): Promise<void> {
    await this.txService.outsideTransaction(async () => {
      const setting = await this.deploymentSettingRepository.findById(deploymentSettingId);
      if (!setting) return;

      await this.#recordFromTemplate("still_running_24h", setting, { isTrial });
    });
  }

  async recordFavorite(templateId: string, action: "favorite" | "unfavorite"): Promise<void> {
    await this.#recordSafely({ action, templateId }, async () => {
      await this.templateUsageEventRepository.record({
        source: "console",
        templateRef: templateId,
        templateVersionId: await this.templateUsageEventRepository.findCurrentVersionIdOfTemplate(templateId),
        action,
        userId: this.executionContextService.get("CURRENT_USER")?.id ?? null,
        organizationId: this.executionContextService.get("ORGANIZATION_CONTEXT")?.organizationId ?? null,
        network: this.coreConfig.get("NETWORK")
      });
    });
  }

  /** Recording is invisible to the caller, so it runs on its own connection and a failure is only warned about, never aborting the caller's transaction or costing them the deploy, lease or favorite. */
  async #recordSafely(context: { action: TemplateUsageAction } & Record<string, unknown>, record: () => Promise<void>): Promise<void> {
    try {
      await this.txService.outsideTransaction(record);
    } catch (error) {
      this.logger.warn({ event: "TEMPLATE_USAGE_RECORD_FAILED", ...context, error });
    }
  }

  /** Answers whether the deployment came from a template, since an event already recorded still counts as one. */
  async #recordFromTemplate(
    action: TemplateUsageAction,
    definition: DeployedDefinition,
    { isTrial, createdAt }: { isTrial: boolean; createdAt?: Date }
  ): Promise<boolean> {
    const ref = await this.templateRefOf(definition);
    if (!ref) return false;

    await this.templateUsageEventRepository.record({
      ...ref,
      action,
      userId: definition.userId,
      organizationId: definition.organizationId,
      deploymentSettingId: definition.id,
      dseq: definition.dseq,
      network: this.coreConfig.get("NETWORK"),
      isTrial,
      ...(createdAt && { createdAt })
    });

    return true;
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
