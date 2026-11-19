import assert from "http-assert";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { TxService } from "@src/core/services";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { DeploymentProjectService } from "@src/deployment/services/deployment-project/deployment-project.service";
import { summarizeTemplateHardware } from "@src/template/utils/template-hardware/template-hardware";
import type { AskedValue } from "@src/template-marketplace/lib/asked-values/asked-values.schema";
import { contentCarriedByLegacySave } from "@src/template-marketplace/lib/legacy-save/content-carried-by-legacy-save";
import { hasPassedPublishChecks, type PublishCheckResults, toPublishCheck } from "@src/template-marketplace/lib/publish-checks/publish-check-results";
import { findReadmeSecretIssues } from "@src/template-marketplace/lib/publish-checks/publish-checks";
import { createChecksFailedError, createPublishGateRequiredError } from "@src/template-marketplace/lib/publish-requirements/publish-refusals";
import { createVersionReviewRequiredError } from "@src/template-marketplace/lib/version-hold/version-review-required-error";
import { TemplateRemovalRepository } from "@src/template-marketplace/repositories/template-removal/template-removal.repository";
import { TemplateVersionRepository } from "@src/template-marketplace/repositories/template-version/template-version.repository";
import { PublishChecksService } from "@src/template-marketplace/services/publish-checks/publish-checks.service";
import { TemplateRateLimiterService } from "@src/template-marketplace/services/template-rate-limiter/template-rate-limiter.service";
import { TemplateImageDigestJobService } from "@src/template-marketplace/services/template-image-digest-job/template-image-digest-job.service";
import { TemplateUsageService } from "@src/template-marketplace/services/template-usage/template-usage.service";
import { TemplateVersionHoldService } from "@src/template-marketplace/services/template-version-hold/template-version-hold.service";
import type { TemplateVisibility } from "@src/user/model-schemas/template/template.schema";
import {
  TemplateInput,
  type TemplateOutput,
  type TemplateVersionState,
  UserTemplateRepository
} from "../../repositories/user-template/user-template.repository";

type TemplateWriteAction = "create" | "update" | "delete";

function visibilityPatch({ isPublic, ...rest }: TemplateInput, stored: TemplateVersionState): Partial<TemplateInput> {
  const isChanged = isPublic !== undefined && isPublic !== stored.isPublic;
  const isDrifted = stored.isPublic !== (stored.visibility === "public");

  return isChanged || isDrifted ? { ...rest, isPublic: isPublic ?? stored.isPublic } : rest;
}

function readmeShownBy(readme: string | null | undefined, description: string | null | undefined): string | null {
  return readme ?? (description || null);
}

@singleton()
export class UserTemplatesService {
  readonly #userTemplateRepository: UserTemplateRepository;
  readonly #authService: AuthService;
  readonly #deploymentProjectService: DeploymentProjectService;
  readonly #templateVersionRepository: TemplateVersionRepository;
  readonly #txService: TxService;
  readonly #templateUsageService: TemplateUsageService;
  readonly #publishChecksService: PublishChecksService;
  readonly #featureFlagsService: FeatureFlagsService;
  readonly #templateRateLimiterService: TemplateRateLimiterService;
  readonly #executionContextService: ExecutionContextService;
  readonly #templateRemovalRepository: TemplateRemovalRepository;
  readonly #templateVersionHoldService: TemplateVersionHoldService;
  readonly #templateImageDigestJobService: TemplateImageDigestJobService;

  constructor(
    userTemplateRepository: UserTemplateRepository,
    authService: AuthService,
    deploymentProjectService: DeploymentProjectService,
    templateVersionRepository: TemplateVersionRepository,
    txService: TxService,
    templateUsageService: TemplateUsageService,
    publishChecksService: PublishChecksService,
    featureFlagsService: FeatureFlagsService,
    templateRateLimiterService: TemplateRateLimiterService,
    executionContextService: ExecutionContextService,
    templateRemovalRepository: TemplateRemovalRepository,
    templateVersionHoldService: TemplateVersionHoldService,
    templateImageDigestJobService: TemplateImageDigestJobService
  ) {
    this.#userTemplateRepository = userTemplateRepository;
    this.#authService = authService;
    this.#deploymentProjectService = deploymentProjectService;
    this.#templateVersionRepository = templateVersionRepository;
    this.#txService = txService;
    this.#templateUsageService = templateUsageService;
    this.#publishChecksService = publishChecksService;
    this.#featureFlagsService = featureFlagsService;
    this.#templateRateLimiterService = templateRateLimiterService;
    this.#executionContextService = executionContextService;
    this.#templateRemovalRepository = templateRemovalRepository;
    this.#templateVersionHoldService = templateVersionHoldService;
    this.#templateImageDigestJobService = templateImageDigestJobService;
  }

  async getTemplateById(id: string, userId: string = ""): Promise<(TemplateOutput & { isFavorite?: boolean }) | null> {
    const readerUserId = this.#readerOf(userId);
    const template = await this.#readableBy(readerUserId).findById(id, readerUserId);
    if (!template) return null;

    if (userId) {
      const isFavorite = await this.#userTemplateRepository.isFavorite(id, userId);
      return { ...template, isFavorite };
    }

    return template;
  }

  async getTemplates(username: string, userId: string = ""): Promise<TemplateOutput[]> {
    if (!userId) {
      return await this.#userTemplateRepository.findAllByUsername(username);
    }

    const readerUserId = this.#readerOf(userId);

    return readerUserId ? await this.#readableBy(readerUserId).findAllByUserId(readerUserId) : [];
  }

  async saveTemplate(id: string | undefined | null, userId: string, { projectId, ...template }: TemplateInput & { projectId?: string }): Promise<string> {
    if (id && (await this.#userTemplateRepository.isAuthoredBy(id, userId))) {
      await this.#updateAndVersion(id, userId, template);
      return id;
    }

    if (this.#wouldPublishOutsidePublishGate(template.isPublic, undefined)) throw createPublishGateRequiredError();

    const repository = this.#writableBy("create");
    const filingProjectId = await this.#deploymentProjectService.resolveFilingProject(projectId, "Template");

    const resources = summarizeTemplateHardware(template.sdl);
    const authorId = this.#authService.currentUser.id;

    return await this.#txService.transaction(async () => {
      await this.#assertWithinRateLimits("create", this.#executionContextService.get("ORGANIZATION_CONTEXT")?.organizationId);
      const templateId = await repository.createTemplate(userId, template, { projectId: filingProjectId, copiedFromId: id, authorId });
      const firstVersion = await this.#templateVersionRepository.appendVersion({ templateId, sdl: template.sdl, resources, createdById: authorId });
      await this.#resolveImageDigestsOf(firstVersion.id);

      return templateId;
    });
  }

  async update(id: string, userId: string, data: Partial<TemplateInput>): Promise<void> {
    await this.#txService.transaction(async () => {
      const stored = await this.#userTemplateRepository.findVersionState(id, userId);

      if (stored && data.description !== undefined && this.#showsDescriptionAsPublishedReadme(stored)) {
        this.#assertReadmeHoldsNoSecret(data.description);
      }

      await this.#writableBy("update").updateTemplate(id, userId, data);
    });
  }

  /** A template that went public through the publish gate keeps its emptied row, so the link shared while it was public can say it was removed. */
  async deleteTemplate(userId: string, id: string): Promise<void> {
    const repository = this.#writableBy("delete");

    await this.#txService.transaction(async () => {
      if (await repository.markRemovedIfEverPublic(id, userId)) {
        await this.#templateRemovalRepository.emptyRemoved(id, "owner");
      } else {
        await repository.deleteById(id, userId);
      }
    });
  }

  async getFavoriteTemplates(userId: string): Promise<Pick<TemplateOutput, "id" | "title" | "description">[]> {
    const readerUserId = this.#readerOf(userId);
    const templates = await this.#readableBy(readerUserId).getFavoriteTemplates(userId, readerUserId);

    return templates.map(t => ({
      id: t.id,
      title: t.title,
      description: t.description
    }));
  }

  async addFavoriteTemplate(userId: string, templateId: string): Promise<void> {
    const readerUserId = this.#readerOf(userId);

    if (await this.#readableBy(readerUserId).addFavorite(userId, templateId, readerUserId)) {
      await this.#templateUsageService.recordFavorite(templateId, "favorite");
    }
  }

  async removeFavoriteTemplate(userId: string, templateId: string): Promise<void> {
    if (await this.#userTemplateRepository.removeFavorite(userId, templateId)) {
      await this.#templateUsageService.recordFavorite(templateId, "unfavorite");
    }
  }

  async #updateAndVersion(id: string, userId: string, template: TemplateInput): Promise<void> {
    const repository = this.#writableBy("update");
    const resources = summarizeTemplateHardware(template.sdl);
    const createdById = this.#authService.currentUser.id;

    await this.#txService.transaction(async () => {
      const stored = await this.#userTemplateRepository.findVersionState(id, userId);
      assert(stored, 404, "Template not found");
      const isNewVersion = !stored.currentVersionId || stored.currentVersionSdl !== template.sdl;
      const carried = isNewVersion
        ? contentCarriedByLegacySave(template.sdl, { readme: stored.currentVersionReadme, askedValues: stored.currentVersionAskedValues }, template.description)
        : {};

      const nextReadmeShown = readmeShownBy(isNewVersion ? carried.readme : stored.currentVersionReadme, template.description ?? stored.description);

      if (this.#wouldPublishOutsidePublishGate(template.isPublic, stored.visibility)) throw createPublishGateRequiredError();
      if (isNewVersion) await this.#assertWithinRateLimits("version", stored.organizationId);

      const checkResults = this.#staysPublicAfterPublishGate(template, stored)
        ? await this.#findPassingPublishChecks(template, stored.organizationId, {
            summary: stored.summary,
            readme: nextReadmeShown,
            askedValues: (isNewVersion ? carried.askedValues : stored.currentVersionAskedValues) ?? []
          })
        : undefined;

      if (isNewVersion && this.#isJudgedForStaffReview(template, stored)) {
        await this.#assertNeedsNoStaffReview(id, template.sdl, stored);
      }

      await repository.updateTemplate(id, userId, visibilityPatch(template, stored));

      if (isNewVersion) {
        const readmesShown = { current: readmeShownBy(stored.currentVersionReadme, stored.description), next: nextReadmeShown };
        const appended = await this.#templateVersionRepository.appendVersion({
          templateId: id,
          sdl: template.sdl,
          resources,
          createdById,
          ...carried,
          readmesShown,
          checkResults
        });
        await this.#resolveImageDigestsOf(appended.id);
      }
    });
  }

  /** A template that went through the publish gate stays held to its checks, since this route can save neither a failed version nor the reason. */
  #staysPublicAfterPublishGate(template: TemplateInput, stored: TemplateVersionState): boolean {
    return stored.visibility === "public" && template.isPublic !== false && this.#wentThroughPublishGate(stored);
  }

  /** The limits count rows whichever route wrote them, so without this the route would keep writing past them. */
  async #assertWithinRateLimits(action: "create" | "version", organizationId: string | undefined): Promise<void> {
    if (!organizationId || !this.#featureFlagsService.isEnabled(FeatureFlags.TEMPLATE_MARKETPLACE)) return;

    await this.#templateRateLimiterService.assertWithinLimits(action, { userId: this.#authService.currentUser.id, organizationId });
  }

  /** A template that went through the gate is judged while it is private too, or a risky version saved in private would go live unreviewed when it is published again. */
  #isJudgedForStaffReview(template: TemplateInput, stored: TemplateVersionState): boolean {
    const staysPublic = stored.visibility === "public" && template.isPublic !== false;

    return this.#featureFlagsService.isEnabled(FeatureFlags.TEMPLATE_MARKETPLACE) && (staysPublic || !!stored.publishedAt);
  }

  /** This route makes every version it saves the current one, so a change that must wait for staff is refused here and saved from the editor instead. */
  async #assertNeedsNoStaffReview(id: string, sdl: string, stored: TemplateVersionState): Promise<void> {
    const holdReasons = await this.#templateVersionHoldService.findHoldReasons(
      { id, organizationId: stored.organizationId, isOfficial: stored.isOfficial },
      stored.currentVersionSdl ?? "",
      sdl
    );

    if (holdReasons.length > 0) throw createVersionReviewRequiredError(holdReasons);
  }

  /** Digests are only read with the marketplace on, and with it off this route must reach no registry. */
  async #resolveImageDigestsOf(versionId: string): Promise<void> {
    if (this.#featureFlagsService.isEnabled(FeatureFlags.TEMPLATE_MARKETPLACE)) await this.#templateImageDigestJobService.schedule(versionId);
  }

  /** With the marketplace on, only the publish route makes a template public, since it alone knows the requirements, the terms and the checks. */
  #wouldPublishOutsidePublishGate(isPublic: boolean | undefined, storedVisibility: TemplateVisibility | undefined): boolean {
    return isPublic === true && storedVisibility !== "public" && this.#featureFlagsService.isEnabled(FeatureFlags.TEMPLATE_MARKETPLACE);
  }

  /** A version without a README of its own shows the template description in its place. */
  #showsDescriptionAsPublishedReadme(stored: TemplateVersionState): boolean {
    return stored.visibility === "public" && stored.currentVersionReadme == null && this.#wentThroughPublishGate(stored);
  }

  #assertReadmeHoldsNoSecret(readme: string): void {
    const issues = findReadmeSecretIssues(readme);

    if (issues.length > 0) throw createChecksFailedError({ ranAt: new Date().toISOString(), checks: [toPublishCheck("no_secrets", issues)] });
  }

  #wentThroughPublishGate(stored: TemplateVersionState): boolean {
    return !!stored.publishedAt && this.#featureFlagsService.isEnabled(FeatureFlags.TEMPLATE_MARKETPLACE);
  }

  async #findPassingPublishChecks(
    template: TemplateInput,
    organizationId: string,
    content: { summary: string | null; readme: string | null; askedValues: AskedValue[] }
  ): Promise<PublishCheckResults> {
    const checkResults = await this.#publishChecksService.run({ sdl: template.sdl, title: template.title, organizationId, ...content });

    if (!hasPassedPublishChecks(checkResults)) throw createChecksFailedError(checkResults);

    return checkResults;
  }

  /** A caller whose rules reach no template, such as a billing member of a team, reads public templates only. */
  #readerOf(userId: string): string {
    return userId && this.#authService.ability.can("read", "Template") ? userId : "";
  }

  #readableBy(readerUserId: string): UserTemplateRepository {
    return readerUserId ? this.#userTemplateRepository.accessibleBy(this.#authService.ability, "read") : this.#userTemplateRepository;
  }

  #writableBy(action: TemplateWriteAction): UserTemplateRepository {
    return this.#userTemplateRepository.accessibleBy(this.#authService.ability, action);
  }
}
