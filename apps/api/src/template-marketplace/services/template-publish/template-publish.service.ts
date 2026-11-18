import { subject } from "@casl/ability";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { StripeTransactionRepository } from "@src/billing/repositories/stripe-transaction/stripe-transaction.repository";
import { TxService } from "@src/core/services";
import {
  hasPassedPublishChecks,
  type PublishCheck,
  type PublishCheckResults,
  toPublishCheck
} from "@src/template-marketplace/lib/publish-checks/publish-check-results";
import {
  createChecksFailedError,
  createRequirementsUnmetError,
  createTermsVersionMismatchError
} from "@src/template-marketplace/lib/publish-requirements/publish-refusals";
import {
  areRequirementsMet,
  COMMUNITY_TEMPLATE_TERMS_VERSION,
  evaluatePublishRequirements,
  type PublishRequirement
} from "@src/template-marketplace/lib/publish-requirements/publish-requirements";
import { publisherHandleCandidates } from "@src/template-marketplace/lib/publisher-handle/publisher-handle";
import { MarketplaceTemplateRepository } from "@src/template-marketplace/repositories/marketplace-template/marketplace-template.repository";
import { TemplatePublisherRepository } from "@src/template-marketplace/repositories/template-publisher/template-publisher.repository";
import { TemplateTermsAcceptanceRepository } from "@src/template-marketplace/repositories/template-terms-acceptance/template-terms-acceptance.repository";
import { TemplateVersionRepository } from "@src/template-marketplace/repositories/template-version/template-version.repository";
import {
  type MarketplaceTemplateOutput,
  MarketplaceTemplateService
} from "@src/template-marketplace/services/marketplace-template/marketplace-template.service";
import { PublishChecksService } from "@src/template-marketplace/services/publish-checks/publish-checks.service";
import { TemplateRateLimiterService } from "@src/template-marketplace/services/template-rate-limiter/template-rate-limiter.service";
import { type StoredTemplate, TemplateWriteAccessService } from "@src/template-marketplace/services/template-write-access/template-write-access.service";

export type PublishReadiness = {
  termsVersion: string;
  requirements: PublishRequirement[];
  checks: PublishCheck[];
  ranAt: string;
  canPublish: boolean;
};

type CheckedVersion = { versionId: string | undefined; checkResults: PublishCheckResults };

const NO_VERSION_ISSUE = "This template has no saved version yet. Open Edit configuration and save it, then make it public.";

@singleton()
export class TemplatePublishService {
  constructor(
    private readonly marketplaceTemplateRepository: MarketplaceTemplateRepository,
    private readonly templateVersionRepository: TemplateVersionRepository,
    private readonly templatePublisherRepository: TemplatePublisherRepository,
    private readonly templateTermsAcceptanceRepository: TemplateTermsAcceptanceRepository,
    private readonly stripeTransactionRepository: StripeTransactionRepository,
    private readonly marketplaceTemplateService: MarketplaceTemplateService,
    private readonly templateWriteAccessService: TemplateWriteAccessService,
    private readonly publishChecksService: PublishChecksService,
    private readonly templateRateLimiterService: TemplateRateLimiterService,
    private readonly authService: AuthService,
    private readonly txService: TxService
  ) {}

  async getReadiness(id: string): Promise<PublishReadiness> {
    const template = await this.templateWriteAccessService.findWritable(id, "update");
    const requirements = await this.#evaluateRequirements(template);
    const { checkResults } = await this.#checkCurrentVersion(template);

    return {
      termsVersion: COMMUNITY_TEMPLATE_TERMS_VERSION,
      requirements,
      checks: checkResults.checks,
      ranAt: checkResults.ranAt,
      canPublish: areRequirementsMet(requirements) && hasPassedPublishChecks(checkResults)
    };
  }

  /** Requirements and checks are judged again on the locked row, so nothing read before the transaction can let a publish through. */
  async publish(id: string, acceptedTermsVersion: string): Promise<MarketplaceTemplateOutput> {
    await this.templateWriteAccessService.findWritable(id, "update");
    const userId = this.authService.currentUser.id;

    await this.txService.transaction(async () => {
      const template = await this.templateWriteAccessService.lockWritable(id, "update");
      await this.templateRateLimiterService.assertWithinLimits("publish", { userId, organizationId: template.organizationId });
      const requirements = await this.#evaluateRequirements(template);

      if (!areRequirementsMet(requirements)) throw createRequirementsUnmetError(requirements);
      if (acceptedTermsVersion !== COMMUNITY_TEMPLATE_TERMS_VERSION) throw createTermsVersionMismatchError();

      const { versionId, checkResults } = await this.#checkCurrentVersion(template);

      if (!versionId || !hasPassedPublishChecks(checkResults)) throw createChecksFailedError(checkResults);

      await this.#ensurePublisher(template.organizationId);
      await this.templateTermsAcceptanceRepository.record({
        templateId: id,
        userId,
        organizationId: template.organizationId,
        termsVersion: COMMUNITY_TEMPLATE_TERMS_VERSION
      });
      await this.templateVersionRepository.recordCheckResults(versionId, checkResults);
      await this.marketplaceTemplateRepository.markPublished(id);
    });

    return await this.marketplaceTemplateService.getTemplate(id);
  }

  async #evaluateRequirements(template: StoredTemplate): Promise<PublishRequirement[]> {
    const publisher = await this.templatePublisherRepository.findByOrganizationId(template.organizationId);

    return evaluatePublishRequirements({
      isEmailVerified: this.authService.currentUser.emailVerified,
      hasOrganizationPaid: await this.stripeTransactionRepository.hasSucceededPayment(template.organizationId),
      mayPublishForOrganization: this.authService.ability.can("publish", subject("Template", { ...template })),
      isPublisherSuspended: !!publisher?.publishingSuspendedAt
    });
  }

  async #checkCurrentVersion(template: StoredTemplate): Promise<CheckedVersion> {
    const current = await this.templateVersionRepository.findCurrent(template.id);

    if (!current) {
      return {
        versionId: undefined,
        checkResults: { ranAt: new Date().toISOString(), checks: [toPublishCheck("sdl_valid", [{ message: NO_VERSION_ISSUE }])] }
      };
    }

    const checkResults = await this.publishChecksService.run({
      sdl: current.sdl,
      askedValues: current.askedValues,
      title: template.title,
      organizationId: template.organizationId
    });

    return { versionId: current.id, checkResults };
  }

  async #ensurePublisher(organizationId: string): Promise<void> {
    const organization = await this.templatePublisherRepository.findPublishingOrganization(organizationId);

    if (!organization) throw new Error(`Organization ${organizationId} of a published template does not exist`);

    await this.templatePublisherRepository.findOrCreate(organizationId, publisherHandleCandidates(organization));
  }
}
