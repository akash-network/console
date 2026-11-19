import assert from "http-assert";
import createError from "http-errors";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { TxService } from "@src/core/services";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { DeploymentProjectService } from "@src/deployment/services/deployment-project/deployment-project.service";
import { summarizeTemplateHardware } from "@src/template/utils/template-hardware/template-hardware";
import type { AskedValue } from "@src/template-marketplace/lib/asked-values/asked-values.schema";
import { findAskedValueIssues } from "@src/template-marketplace/lib/asked-values/find-asked-value-issues";
import { findSecretValueIssues } from "@src/template-marketplace/lib/asked-values/find-secret-value-issues";
import { legacyHardwareOf } from "@src/template-marketplace/lib/legacy-mirror/legacy-version-mirror";
import { hasPassedPublishChecks, type PublishCheckResults, toPublishCheck } from "@src/template-marketplace/lib/publish-checks/publish-check-results";
import { findReservedTitleIssues } from "@src/template-marketplace/lib/publish-checks/publish-checks";
import { createChecksFailedError } from "@src/template-marketplace/lib/publish-requirements/publish-refusals";
import type { TemplateCategory, TemplateIcon } from "@src/template-marketplace/lib/template-catalog/template-catalog";
import { createTemplateInvalidError } from "@src/template-marketplace/lib/template-invalid/template-invalid-error";
import type { TemplateVersionHoldReason } from "@src/template-marketplace/lib/version-hold/version-hold-reasons";
import {
  MarketplaceTemplateRepository,
  type MarketplaceTemplateRow,
  type TemplateSettingsUpdate
} from "@src/template-marketplace/repositories/marketplace-template/marketplace-template.repository";
import { TemplateRemovalRepository } from "@src/template-marketplace/repositories/template-removal/template-removal.repository";
import {
  TEMPLATE_VERSION_CONFLICT_ERROR_CODE,
  type TemplateVersionOutput,
  TemplateVersionRepository
} from "@src/template-marketplace/repositories/template-version/template-version.repository";
import {
  type MarketplaceTemplateOutput,
  MarketplaceTemplateService,
  type PublishedTemplateVersion
} from "@src/template-marketplace/services/marketplace-template/marketplace-template.service";
import { PublishChecksService } from "@src/template-marketplace/services/publish-checks/publish-checks.service";
import { TemplateImageDigestJobService } from "@src/template-marketplace/services/template-image-digest-job/template-image-digest-job.service";
import { TemplatePublisherNotifierService } from "@src/template-marketplace/services/template-publisher-notifier/template-publisher-notifier.service";
import { TemplateRateLimiterService } from "@src/template-marketplace/services/template-rate-limiter/template-rate-limiter.service";
import { TemplateSdlValidatorService } from "@src/template-marketplace/services/template-sdl-validator/template-sdl-validator.service";
import { TemplateUsageService } from "@src/template-marketplace/services/template-usage/template-usage.service";
import { TemplateVersionHoldService } from "@src/template-marketplace/services/template-version-hold/template-version-hold.service";
import { type StoredTemplate, TemplateWriteAccessService } from "@src/template-marketplace/services/template-write-access/template-write-access.service";

export type CreateUserTemplateInput = {
  title: string;
  summary?: string;
  icon?: TemplateIcon;
  categories?: TemplateCategory[];
  /** Left out of a copy, which then takes the content of the version people deploy from the template it names. */
  sdl?: string;
  readme?: string;
  askedValues?: AskedValue[];
  projectId?: string;
  copiedFromId?: string;
};

type TemplateContent = { sdl: string; readme?: string; askedValues: AskedValue[] };

export type AppendUserTemplateVersionInput = {
  sdl: string;
  readme?: string | null;
  askedValues: AskedValue[];
  baseVersion?: number;
};

export type TemplateSettingsPatch = {
  title?: string;
  summary?: string | null;
  icon?: TemplateIcon | null;
  categories?: TemplateCategory[];
  visibility?: "private" | "organization";
};

const BASE_VERSION_REQUIRED_ERROR_CODE = "template_base_version_required";

/** A version saved before readmes were recorded shows the legacy description instead, so that is what an omitted readme carries forward. */
function readmeShownFor(base: TemplateVersionOutput | undefined, template: StoredTemplate): string | null {
  return base?.readme ?? (template.description || null);
}

/** The legacy `isPublic` flag must stay equal to a public visibility, and settings only set private or organization ones. */
function settingsUpdateOf({ summary, ...patch }: TemplateSettingsPatch): TemplateSettingsUpdate {
  return {
    ...patch,
    ...(summary !== undefined && { summary: summary || null }),
    ...(patch.visibility && { isPublic: false })
  };
}

/** A public template's title is held to the reserved-name check alone, since a rename changes nothing else the checks read. */
function assertTitleNotReserved(title: string): void {
  const issues = findReservedTitleIssues(title);

  if (issues.length > 0) {
    throw createChecksFailedError({ ranAt: new Date().toISOString(), checks: [toPublishCheck("name_not_reserved", issues)] });
  }
}

@singleton()
export class TemplateWriterService {
  constructor(
    private readonly marketplaceTemplateRepository: MarketplaceTemplateRepository,
    private readonly templateVersionRepository: TemplateVersionRepository,
    private readonly templateRemovalRepository: TemplateRemovalRepository,
    private readonly marketplaceTemplateService: MarketplaceTemplateService,
    private readonly deploymentProjectService: DeploymentProjectService,
    private readonly templateSdlValidatorService: TemplateSdlValidatorService,
    private readonly templateWriteAccessService: TemplateWriteAccessService,
    private readonly publishChecksService: PublishChecksService,
    private readonly templateRateLimiterService: TemplateRateLimiterService,
    private readonly templatePublisherNotifierService: TemplatePublisherNotifierService,
    private readonly templateVersionHoldService: TemplateVersionHoldService,
    private readonly templateImageDigestJobService: TemplateImageDigestJobService,
    private readonly templateUsageService: TemplateUsageService,
    private readonly authService: AuthService,
    private readonly txService: TxService,
    private readonly executionContextService: ExecutionContextService
  ) {}

  async create(input: CreateUserTemplateInput): Promise<MarketplaceTemplateOutput> {
    const ability = this.authService.ability;
    const { id: authorId, userId } = this.authService.currentUser;
    const organizationId = this.executionContextService.get("ORGANIZATION_CONTEXT")?.organizationId;
    assert(userId && organizationId && ability.can("create", "Template"), 403, "You cannot create templates");
    const source = input.copiedFromId ? await this.marketplaceTemplateService.findReadable(input.copiedFromId) : undefined;
    const content = await this.#contentOf(input, source);
    this.#assertValid(content.sdl, content.askedValues);

    const projectId = await this.deploymentProjectService.resolveFilingProject(input.projectId, "Template");
    const hardware = summarizeTemplateHardware(content.sdl);
    const repository = this.marketplaceTemplateRepository.accessibleBy(ability, "create");

    const templateId = await this.txService.transaction(async () => {
      await this.templateRateLimiterService.assertWithinLimits("create", { userId: authorId, organizationId });
      const id = await repository.createTemplate({
        title: input.title,
        summary: input.summary || null,
        icon: input.icon,
        categories: input.categories,
        userId,
        authorId,
        projectId,
        copiedFromId: input.copiedFromId,
        sdl: content.sdl,
        description: content.readme ?? "",
        ...legacyHardwareOf(hardware)
      });
      const firstVersion = await this.templateVersionRepository.appendVersion({
        templateId: id,
        sdl: content.sdl,
        readme: content.readme ?? null,
        askedValues: content.askedValues,
        resources: hardware ?? null,
        createdById: authorId
      });
      await this.templateImageDigestJobService.schedule(firstVersion.id);

      if (source) {
        await this.templateUsageService.recordFork(source, { userId: authorId, organizationId });
      }

      return id;
    });

    return await this.marketplaceTemplateService.getTemplate(templateId);
  }

  /** The base version is checked again under the append lock, so of two editors saving from the same base only the first succeeds. */
  async appendVersion(id: string, input: AppendUserTemplateVersionInput): Promise<PublishedTemplateVersion> {
    await this.templateWriteAccessService.findWritable(id, "update");
    this.#assertValid(input.sdl, input.askedValues);
    const hardware = summarizeTemplateHardware(input.sdl);
    const createdById = this.authService.currentUser.id;

    return await this.txService.transaction(async () => {
      const template = await this.templateWriteAccessService.lockWritable(id, "update");
      await this.templateRateLimiterService.assertWithinLimits("version", { userId: createdById, organizationId: template.organizationId });
      const base = template.currentVersionId ? await this.#findBaseVersion(id, input.baseVersion) : undefined;
      const currentReadmeShown = readmeShownFor(base, template);
      const readme = input.readme === undefined ? currentReadmeShown : input.readme;
      const checkResults = template.visibility === "public" ? await this.#runPublishChecks(template, { ...input, readme }) : undefined;
      const appended = await this.templateVersionRepository.appendVersion({
        templateId: id,
        sdl: input.sdl,
        readme,
        askedValues: input.askedValues,
        resources: hardware ?? null,
        createdById,
        expectedCurrentVersionId: base && (await this.#currentVersionExpectedFrom(base, template)),
        readmesShown: { current: currentReadmeShown, next: readme },
        checkResults,
        holdReasons: this.#isJudgedForHold(checkResults) ? await this.#findHoldReasons(template, input.sdl) : undefined
      });
      await this.templateImageDigestJobService.schedule(appended.id);

      if (appended.status === "live") {
        await this.marketplaceTemplateRepository.mirrorVersion(id, {
          sdl: input.sdl,
          description: readme ?? "",
          ...legacyHardwareOf(hardware)
        });
      }
      if (appended.status === "failed_checks") {
        await this.templatePublisherNotifierService.notifyVersionFailedChecks({ versionId: appended.id, savedByUserId: createdById });
      }
      if (appended.status === "held") {
        await this.templatePublisherNotifierService.notifyVersionHeld(appended.id);
      }

      return appended;
    });
  }

  async updateSettings(id: string, patch: TemplateSettingsPatch): Promise<MarketplaceTemplateOutput> {
    await this.templateWriteAccessService.findWritable(id, "update");

    await this.txService.transaction(async () => {
      const template = await this.templateWriteAccessService.lockWritable(id, "update");

      if (template.visibility === "private" && patch.visibility === "organization") {
        await this.#assertNoSecretValueSaved(template);
      }
      if (template.visibility === "public" && patch.visibility === undefined && patch.title !== undefined) {
        assertTitleNotReserved(patch.title);
      }

      await this.marketplaceTemplateRepository.updateSettings(id, settingsUpdateOf(patch));
    });

    return await this.marketplaceTemplateService.getTemplate(id);
  }

  async delete(id: string): Promise<void> {
    await this.templateWriteAccessService.findWritable(id, "delete");

    await this.txService.transaction(async () => {
      await this.templateWriteAccessService.lockWritable(id, "delete");
      await this.templateRemovalRepository.remove(id, "owner");
    });
  }

  /** A copy sent without an SDL takes what the source's readers deploy: its current version, never a newer one that failed its checks or waits for review. */
  async #contentOf(input: CreateUserTemplateInput, source: MarketplaceTemplateRow | undefined): Promise<TemplateContent> {
    if (input.sdl !== undefined) return { sdl: input.sdl, readme: input.readme, askedValues: input.askedValues ?? [] };
    if (!source) throw createError(400, "Send the SDL, or name the template to copy");

    const current = source.currentVersionId ? await this.templateVersionRepository.findById(source.currentVersionId) : undefined;

    return {
      sdl: current?.sdl ?? source.sdl,
      readme: current?.readme ?? (source.description || undefined),
      askedValues: current?.askedValues ?? []
    };
  }

  /** A version saved through the legacy route was never validated, so it is held to a new save's SDL and secret checks before more members can read it. */
  async #assertNoSecretValueSaved(template: StoredTemplate): Promise<void> {
    const current = await this.templateVersionRepository.findCurrent(template.id);
    const sdl = current?.sdl ?? template.sdl;
    const sdlIssues = this.templateSdlValidatorService.findIssues(sdl);
    const issues = sdlIssues.length > 0 ? sdlIssues : findSecretValueIssues(sdl, current?.askedValues ?? []);

    if (issues.length > 0) throw createTemplateInvalidError(issues);
  }

  async #findBaseVersion(id: string, baseVersion: number | undefined): Promise<TemplateVersionOutput> {
    if (baseVersion === undefined) {
      throw createError(400, "Name the version this one was edited from", { errorCode: BASE_VERSION_REQUIRED_ERROR_CODE });
    }

    const base = await this.templateVersionRepository.findByTemplateAndVersion(id, baseVersion);

    if (!base) {
      throw createError(409, "The template has a newer version", { errorCode: TEMPLATE_VERSION_CONFLICT_ERROR_CODE });
    }

    return base;
  }

  /** A version that failed its checks, waits for review or was rejected never became the current one, so a save edited from it is held to the version that was current when it was saved. */
  async #currentVersionExpectedFrom(base: TemplateVersionOutput, template: StoredTemplate): Promise<string | undefined> {
    if (base.status === "live") return base.id;

    const current = await this.templateVersionRepository.findCurrent(template.id);

    return current && current.version < base.version ? current.id : base.id;
  }

  /** A template that is not public is judged too, or a risky version of a popular or Official one saved in private would go live unreviewed when it is published again. */
  #isJudgedForHold(checkResults: PublishCheckResults | undefined): boolean {
    return !checkResults || hasPassedPublishChecks(checkResults);
  }

  /** Compared with the version people deploy today, whichever version the save was edited from. */
  async #findHoldReasons(template: StoredTemplate, sdl: string): Promise<TemplateVersionHoldReason[]> {
    const current = await this.templateVersionRepository.findCurrent(template.id);

    return await this.templateVersionHoldService.findHoldReasons(template, current?.sdl ?? template.sdl, sdl);
  }

  async #runPublishChecks(template: StoredTemplate, input: AppendUserTemplateVersionInput & { readme: string | null }): Promise<PublishCheckResults> {
    return await this.publishChecksService.run({
      sdl: input.sdl,
      readme: input.readme,
      askedValues: input.askedValues,
      title: template.title,
      summary: template.summary,
      organizationId: template.organizationId
    });
  }

  #assertValid(sdl: string, askedValues: AskedValue[]): void {
    const sdlIssues = this.templateSdlValidatorService.findIssues(sdl);
    const issues = sdlIssues.length > 0 ? sdlIssues : [...findAskedValueIssues(sdl, askedValues), ...findSecretValueIssues(sdl, askedValues)];

    if (issues.length > 0) {
      throw createTemplateInvalidError(issues);
    }
  }
}
