import { addHours } from "date-fns";
import { inject, singleton } from "tsyringe";

import { UserWalletRepository } from "@src/billing/repositories";
import { type CreateLogger, JobQueueService, LOGGER_FACTORY } from "@src/core";
import { TxService } from "@src/core/services";
import { AnalyticsService } from "@src/core/services/analytics/analytics.service";
import { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { DeploymentSettingRepository, type DeploymentSettingsOutput } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type { TemplateSource, TemplateUsageAction } from "@src/template-marketplace/model-schemas/template-usage-event/template-usage-event.schema";
import {
  TemplateUsageEventRepository,
  type VersionedTemplate
} from "@src/template-marketplace/repositories/template-usage-event/template-usage-event.repository";
import {
  CheckTemplateDeploymentStillRunning,
  checkTemplateDeploymentStillRunningKeyFor
} from "@src/template-marketplace/services/check-template-deployment-still-running/check-template-deployment-still-running.job";

export type TemplateRef = { source: TemplateSource; templateRef: string; templateVersionId: string | null };

export type DeployedDefinition = Pick<DeploymentSettingsOutput, "id" | "userId" | "organizationId" | "dseq" | "templateId" | "templateVersionId">;

export type ForkedTemplate = { id: string; organizationId: string; currentVersionId: string | null };

const STILL_RUNNING_CHECK_DELAY_HOURS = 24;

type TrackedAction = "deploy" | "lease_created" | "still_running_24h" | "fork";

const ANALYTICS_EVENTS = {
  deploy: "template_deployed",
  lease_created: "template_lease_created",
  still_running_24h: "template_still_running_24h",
  fork: "template_forked"
} as const satisfies Record<TrackedAction, string>;

/** What analytics may know of a template: where it comes from, its id and its version number, never anything its author wrote. */
export type TrackedTemplate = { source: "official" | "community" | "private"; template_id: string; template_version: number | null };

/** A deployment names an awesome-akash template in free text, so only an id shaped like the gallery's is passed on. */
const AWESOME_AKASH_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/;

function trackedSourceOf({ isOfficial, visibility }: Pick<VersionedTemplate, "isOfficial" | "visibility">): TrackedTemplate["source"] {
  if (isOfficial) return "official";

  return visibility === "public" ? "community" : "private";
}

function trackedConsoleTemplate(template: VersionedTemplate): TrackedTemplate {
  return { source: trackedSourceOf(template), template_id: template.templateId, template_version: template.versionNumber };
}

function trackedAwesomeAkashTemplate(templateId: string): TrackedTemplate | undefined {
  return AWESOME_AKASH_ID.test(templateId) ? { source: "official", template_id: templateId, template_version: null } : undefined;
}

type ResolvedTemplate = { ref: TemplateRef; tracked: TrackedTemplate | undefined };

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
    private readonly analyticsService: AnalyticsService,
    private readonly featureFlags: FeatureFlagsService,
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

  /** Runs in the caller's transaction, unlike the other recorders, since the lock it holds on the user is what keeps a day to one fork. */
  async recordFork(source: ForkedTemplate, fork: { userId: string; organizationId: string }): Promise<void> {
    if (source.organizationId === fork.organizationId) return;

    const isCounted = await this.templateUsageEventRepository.recordForkOncePerDay({
      templateRef: source.id,
      templateVersionId: source.currentVersionId,
      userId: fork.userId,
      organizationId: fork.organizationId,
      network: this.coreConfig.get("NETWORK")
    });
    if (!isCounted || !source.currentVersionId) return;

    const copied = await this.templateUsageEventRepository.findTemplateOfVersion(source.currentVersionId);
    if (copied) this.txService.afterCommit(() => this.#track("fork", fork.userId, trackedConsoleTemplate(copied)));
  }

  /** Analytics is told once per counted event and only of users the marketplace is on for, and a failure to tell it costs the caller nothing. */
  #track(action: TrackedAction, userId: string | null, template: TrackedTemplate | undefined, insertId?: string): void {
    if (!userId || !template) return;

    try {
      if (!this.featureFlags.isEnabledForSubject(FeatureFlags.TEMPLATE_MARKETPLACE, userId)) return;

      this.analyticsService.track(userId, ANALYTICS_EVENTS[action], { ...template, network: this.coreConfig.get("NETWORK") }, { insertId });
    } catch (error) {
      this.logger.warn({ event: "TEMPLATE_USAGE_TRACK_FAILED", action, error });
    }
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
    action: Exclude<TrackedAction, "fork">,
    definition: DeployedDefinition,
    { isTrial, createdAt }: { isTrial: boolean; createdAt?: Date }
  ): Promise<boolean> {
    const template = await this.#resolveTemplate(definition);
    if (!template) return false;

    const { ref, tracked } = template;
    const isNew = await this.templateUsageEventRepository.record({
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
    if (isNew) this.#track(action, definition.userId, tracked, `template_${action}:${definition.id}`);

    return true;
  }

  async templateRefOf(definition: Pick<DeploymentSettingsOutput, "templateId" | "templateVersionId">): Promise<TemplateRef | undefined> {
    return (await this.#resolveTemplate(definition))?.ref;
  }

  /** A version whose template was deleted names nothing left to count, so it resolves to nothing. */
  async #resolveTemplate({
    templateId,
    templateVersionId
  }: Pick<DeploymentSettingsOutput, "templateId" | "templateVersionId">): Promise<ResolvedTemplate | undefined> {
    if (templateVersionId) {
      const template = await this.templateUsageEventRepository.findTemplateOfVersion(templateVersionId);

      return template && { ref: { source: "console", templateRef: template.templateId, templateVersionId }, tracked: trackedConsoleTemplate(template) };
    }

    if (templateId)
      return { ref: { source: "awesome_akash", templateRef: templateId, templateVersionId: null }, tracked: trackedAwesomeAkashTemplate(templateId) };

    return undefined;
  }
}
