import { createMongoAbility, type MongoAbility, type RawRuleOf } from "@casl/ability";
import { faker } from "@faker-js/faker";
import createError from "http-errors";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { StripeTransactionRepository } from "@src/billing/repositories/stripe-transaction/stripe-transaction.repository";
import type { TxService } from "@src/core/services";
import type { PublishCheckResults } from "@src/template-marketplace/lib/publish-checks/publish-check-results";
import { COMMUNITY_TEMPLATE_TERMS_VERSION } from "@src/template-marketplace/lib/publish-requirements/publish-requirements";
import type {
  MarketplaceTemplateRepository,
  MarketplaceTemplateRow
} from "@src/template-marketplace/repositories/marketplace-template/marketplace-template.repository";
import type {
  PublishingOrganization,
  TemplatePublisherOutput,
  TemplatePublisherRepository
} from "@src/template-marketplace/repositories/template-publisher/template-publisher.repository";
import type { TemplateTermsAcceptanceRepository } from "@src/template-marketplace/repositories/template-terms-acceptance/template-terms-acceptance.repository";
import type { TemplateVersionOutput, TemplateVersionRepository } from "@src/template-marketplace/repositories/template-version/template-version.repository";
import type {
  MarketplaceTemplateOutput,
  MarketplaceTemplateService
} from "@src/template-marketplace/services/marketplace-template/marketplace-template.service";
import type { PublishChecksService } from "@src/template-marketplace/services/publish-checks/publish-checks.service";
import type { TemplateRateLimiterService } from "@src/template-marketplace/services/template-rate-limiter/template-rate-limiter.service";
import type { TemplateWriteAccessService } from "@src/template-marketplace/services/template-write-access/template-write-access.service";
import type { UserOutput } from "@src/user/repositories";
import { TemplatePublishService } from "./template-publish.service";

const PASSED_CHECKS: PublishCheckResults = {
  ranAt: "2026-11-18T10:00:00.000Z",
  checks: [
    { key: "sdl_valid", status: "passed", issues: [] },
    { key: "fixed_tags", status: "passed", issues: [] }
  ]
};
const FAILED_CHECKS: PublishCheckResults = {
  ranAt: "2026-11-18T10:00:00.000Z",
  checks: [
    { key: "sdl_valid", status: "passed", issues: [] },
    { key: "fixed_tags", status: "failed", issues: [{ message: "Pin the tag.", service: "web", image: "nginx" }] }
  ]
};
const ALL_MET = [
  { key: "email_verified", met: true },
  { key: "organization_payment", met: true },
  { key: "publisher_role", met: true },
  { key: "publisher_in_good_standing", met: true }
];
const NO_VERSION_ISSUE = "This template has no saved version yet. Open Edit configuration and save it, then make it public.";

describe(TemplatePublishService.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getReadiness", () => {
    it("tells a verified owner of a paying organization that a template passing its checks can be published", async () => {
      const { service, template, version, templateWriteAccessService, publishChecksService, stripeTransactionRepository } = setup();

      const readiness = await service.getReadiness(template.id);

      expect(readiness).toEqual({
        termsVersion: COMMUNITY_TEMPLATE_TERMS_VERSION,
        requirements: ALL_MET,
        checks: PASSED_CHECKS.checks,
        ranAt: PASSED_CHECKS.ranAt,
        canPublish: true
      });
      expect(templateWriteAccessService.findWritable).toHaveBeenCalledWith(template.id, "update");
      expect(stripeTransactionRepository.hasSucceededPayment).toHaveBeenCalledWith(template.organizationId);
      expect(publishChecksService.run).toHaveBeenCalledWith({
        sdl: version.sdl,
        readme: "# Llama",
        askedValues: version.askedValues,
        title: template.title,
        summary: "Chat with Llama 3.1.",
        organizationId: template.organizationId
      });
    });

    it.each([
      { shape: "the template description", description: "Chat with Llama", expected: "Chat with Llama" },
      { shape: "nothing when the description is empty too", description: "", expected: null }
    ])("checks $shape for a version that has no README", async ({ description, expected }) => {
      const { service, template, publishChecksService } = setup({ readme: null, description });

      await service.getReadiness(template.id);

      expect(publishChecksService.run).toHaveBeenCalledWith(expect.objectContaining({ readme: expected }));
    });

    it.each([
      { unmet: "email_verified", input: { isEmailVerified: false } },
      { unmet: "organization_payment", input: { hasPaid: false } },
      {
        unmet: "publisher_role",
        input: {
          rules: [
            { action: "manage", subject: "Template" },
            { action: "publish", subject: "Template", inverted: true }
          ]
        }
      },
      { unmet: "publisher_in_good_standing", input: { publisher: { publishingSuspendedAt: new Date() } } }
    ])("tells that $unmet stands in the way", async ({ unmet, input }) => {
      const { service, template } = setup(input);

      const readiness = await service.getReadiness(template.id);

      expect(readiness.requirements.filter(requirement => !requirement.met).map(requirement => requirement.key)).toEqual([unmet]);
      expect(readiness.canPublish).toBe(false);
    });

    it("judges the publish rule against the template itself", async () => {
      const otherProjectId = faker.string.uuid();
      const { service, template } = setup({ rules: [{ action: "publish", subject: "Template", conditions: { projectId: otherProjectId } }] });

      const readiness = await service.getReadiness(template.id);

      expect(readiness.requirements).toContainEqual({ key: "publisher_role", met: false });
    });

    it("meets good standing for a publisher that was never suspended and for an organization that never published", async () => {
      const neverSuspended = setup({ publisher: { publishingSuspendedAt: null } });
      const neverPublished = setup({ publisher: null });

      const [first, second] = await Promise.all([
        neverSuspended.service.getReadiness(neverSuspended.template.id),
        neverPublished.service.getReadiness(neverPublished.template.id)
      ]);

      expect(first.requirements).toContainEqual({ key: "publisher_in_good_standing", met: true });
      expect(second.requirements).toContainEqual({ key: "publisher_in_good_standing", met: true });
    });

    it("tells that failing checks stand in the way, with what they found", async () => {
      const { service, template } = setup({ checkResults: FAILED_CHECKS });

      const readiness = await service.getReadiness(template.id);

      expect(readiness).toMatchObject({ requirements: ALL_MET, checks: FAILED_CHECKS.checks, canPublish: false });
    });

    it("asks for a first save of a template that has no version to check", async () => {
      vi.useFakeTimers({ now: new Date("2026-11-18T12:00:00.000Z") });
      const { service, template, publishChecksService } = setup({ version: null });

      const readiness = await service.getReadiness(template.id);

      expect(readiness).toMatchObject({
        checks: [{ key: "sdl_valid", status: "failed", issues: [{ message: NO_VERSION_ISSUE }] }],
        ranAt: "2026-11-18T12:00:00.000Z",
        canPublish: false
      });
      expect(publishChecksService.run).not.toHaveBeenCalled();
    });

    it("refuses a caller who may not change the template", async () => {
      const refusal = createError(403, "You cannot change this template");
      const { service, template, templateWriteAccessService, publishChecksService } = setup();
      templateWriteAccessService.findWritable.mockRejectedValue(refusal);

      await expect(service.getReadiness(template.id)).rejects.toBe(refusal);
      expect(publishChecksService.run).not.toHaveBeenCalled();
    });
  });

  describe("publish", () => {
    it("publishes the locked template in one transaction, under the limits, and answers it", async () => {
      const { service, template, version, user, steps, marketplaceTemplateService, repositories, templateRateLimiterService, templateWriteAccessService } =
        setup();

      const result = await service.publish(template.id, COMMUNITY_TEMPLATE_TERMS_VERSION);

      expect(result).toBe(await marketplaceTemplateService.getTemplate.mock.results[0].value);
      expect(marketplaceTemplateService.getTemplate).toHaveBeenCalledWith(template.id);
      expect(steps).toEqual([
        "findWritable",
        "begin",
        "lockWritable",
        "assertWithinLimits",
        "findOrCreate",
        "recordAcceptance",
        "recordCheckResults",
        "markPublished",
        "end",
        "getTemplate"
      ]);
      expect(templateWriteAccessService.lockWritable).toHaveBeenCalledWith(template.id, "update");
      expect(templateRateLimiterService.assertWithinLimits).toHaveBeenCalledWith("publish", { userId: user.id, organizationId: template.organizationId });
      expect(repositories.acceptances.record).toHaveBeenCalledWith({
        templateId: template.id,
        userId: user.id,
        organizationId: template.organizationId,
        termsVersion: COMMUNITY_TEMPLATE_TERMS_VERSION
      });
      expect(repositories.versions.recordCheckResults).toHaveBeenCalledWith(version.id, PASSED_CHECKS);
      expect(repositories.templates.markPublished).toHaveBeenCalledWith(template.id);
    });

    it("creates the publisher under a handle taken from the team's slug", async () => {
      const { service, template, repositories } = setup({ organization: { name: "Acme Labs", slug: "acme-labs", type: "team", ownerUsername: "sam" } });

      await service.publish(template.id, COMMUNITY_TEMPLATE_TERMS_VERSION);

      expect(repositories.publishers.findPublishingOrganization).toHaveBeenCalledWith(template.organizationId);
      expect(repositories.publishers.findOrCreate).toHaveBeenCalledWith(template.organizationId, expect.arrayContaining(["acme-labs", "acme-labs-2"]));
      expect(repositories.publishers.findOrCreate.mock.calls[0][1][0]).toBe("acme-labs");
    });

    it("judges the requirements on the locked row rather than the one read before the transaction", async () => {
      const lockedOrganizationId = faker.string.uuid();
      const { service, template, stripeTransactionRepository, repositories } = setup({ locked: { organizationId: lockedOrganizationId } });

      await service.publish(template.id, COMMUNITY_TEMPLATE_TERMS_VERSION);

      expect(stripeTransactionRepository.hasSucceededPayment).toHaveBeenCalledWith(lockedOrganizationId);
      expect(repositories.publishers.findByOrganizationId).toHaveBeenCalledWith(lockedOrganizationId);
      expect(repositories.acceptances.record).toHaveBeenCalledWith(expect.objectContaining({ organizationId: lockedOrganizationId }));
    });

    it("refuses with the unmet requirements and publishes nothing", async () => {
      const { service, template, repositories } = setup({ isEmailVerified: false, hasPaid: false });

      await expect(service.publish(template.id, COMMUNITY_TEMPLATE_TERMS_VERSION)).rejects.toMatchObject({
        status: 403,
        errorCode: "template_publish_requirements_unmet",
        data: { unmet: ["email_verified", "organization_payment"] }
      });
      expectNothingPublished(repositories);
    });

    it("refuses terms other than the current ones and publishes nothing", async () => {
      const { service, template, repositories, publishChecksService } = setup();

      await expect(service.publish(template.id, "2020-01")).rejects.toMatchObject({
        status: 409,
        errorCode: "template_terms_version_mismatch",
        data: { termsVersion: COMMUNITY_TEMPLATE_TERMS_VERSION }
      });
      expect(publishChecksService.run).not.toHaveBeenCalled();
      expectNothingPublished(repositories);
    });

    it("names the unmet requirements before stale terms", async () => {
      const { service, template } = setup({ isEmailVerified: false });

      await expect(service.publish(template.id, "2020-01")).rejects.toMatchObject({ errorCode: "template_publish_requirements_unmet" });
    });

    it("refuses a current version that fails the checks, with what they found, and publishes nothing", async () => {
      const { service, template, repositories } = setup({ checkResults: FAILED_CHECKS });

      await expect(service.publish(template.id, COMMUNITY_TEMPLATE_TERMS_VERSION)).rejects.toMatchObject({
        status: 400,
        errorCode: "template_publish_checks_failed",
        message: "Pin the tag.",
        data: { checks: FAILED_CHECKS.checks }
      });
      expectNothingPublished(repositories);
    });

    it("refuses a template that has no version to check", async () => {
      const { service, template, repositories } = setup({ version: null });

      await expect(service.publish(template.id, COMMUNITY_TEMPLATE_TERMS_VERSION)).rejects.toMatchObject({
        status: 400,
        errorCode: "template_publish_checks_failed",
        message: NO_VERSION_ISSUE
      });
      expectNothingPublished(repositories);
    });

    it("publishes nothing once a limit is reached, before judging anything else", async () => {
      const rateLimitError = createError(429, "Too many", { errorCode: "template_rate_limited" });
      const { service, template, repositories, templateRateLimiterService, stripeTransactionRepository } = setup({ isEmailVerified: false });
      templateRateLimiterService.assertWithinLimits.mockRejectedValue(rateLimitError);

      await expect(service.publish(template.id, COMMUNITY_TEMPLATE_TERMS_VERSION)).rejects.toBe(rateLimitError);
      expect(stripeTransactionRepository.hasSucceededPayment).not.toHaveBeenCalled();
      expectNothingPublished(repositories);
    });

    it("opens no transaction for a caller who may not change the template", async () => {
      const refusal = createError(404, "Template not found");
      const { service, template, templateWriteAccessService, txService } = setup();
      templateWriteAccessService.findWritable.mockRejectedValue(refusal);

      await expect(service.publish(template.id, COMMUNITY_TEMPLATE_TERMS_VERSION)).rejects.toBe(refusal);
      expect(txService.transaction).not.toHaveBeenCalled();
    });

    it("fails loudly when the organization of the template is gone", async () => {
      const { service, template, repositories } = setup({ organization: null });

      await expect(service.publish(template.id, COMMUNITY_TEMPLATE_TERMS_VERSION)).rejects.toThrow(
        `Organization ${template.organizationId} of a published template does not exist`
      );
      expect(repositories.templates.markPublished).not.toHaveBeenCalled();
    });
  });

  function expectNothingPublished(repositories: ReturnType<typeof setup>["repositories"]) {
    expect(repositories.publishers.findOrCreate).not.toHaveBeenCalled();
    expect(repositories.acceptances.record).not.toHaveBeenCalled();
    expect(repositories.versions.recordCheckResults).not.toHaveBeenCalled();
    expect(repositories.templates.markPublished).not.toHaveBeenCalled();
  }

  function setup(
    input: {
      rules?: RawRuleOf<MongoAbility>[];
      isEmailVerified?: boolean;
      hasPaid?: boolean;
      publisher?: Partial<TemplatePublisherOutput> | null;
      organization?: PublishingOrganization | null;
      checkResults?: PublishCheckResults;
      version?: null;
      readme?: string | null;
      description?: string;
      locked?: Partial<MarketplaceTemplateRow>;
    } = {}
  ) {
    const steps: string[] = [];
    const template = mock<MarketplaceTemplateRow>({
      id: faker.string.uuid(),
      organizationId: faker.string.uuid(),
      projectId: faker.string.uuid(),
      title: "Llama 3.1 Chat",
      summary: "Chat with Llama 3.1.",
      description: input.description ?? ""
    });
    const version = mock<TemplateVersionOutput>({
      id: faker.string.uuid(),
      sdl: "version: '2.0'",
      askedValues: [],
      readme: input.readme === undefined ? "# Llama" : input.readme
    });
    const user = mock<UserOutput>({ id: faker.string.uuid(), emailVerified: input.isEmailVerified ?? true });
    const authService = mock<AuthService>();
    authService.ability = createMongoAbility<MongoAbility>(input.rules ?? [{ action: "manage", subject: "Template" }]);
    authService.currentUser = user;

    const templates = mock<MarketplaceTemplateRepository>();
    templates.markPublished.mockImplementation(async () => {
      steps.push("markPublished");
    });
    const versions = mock<TemplateVersionRepository>();
    versions.findCurrent.mockResolvedValue(input.version === null ? undefined : version);
    versions.recordCheckResults.mockImplementation(async () => {
      steps.push("recordCheckResults");
    });
    const publishers = mock<TemplatePublisherRepository>();
    publishers.findByOrganizationId.mockResolvedValue(input.publisher ? mock<TemplatePublisherOutput>(input.publisher) : undefined);
    publishers.findPublishingOrganization.mockResolvedValue(
      input.organization === null
        ? undefined
        : input.organization ?? { name: "Sam Rivera", slug: "personal-0123456789ab", type: "personal", ownerUsername: "sam" }
    );
    publishers.findOrCreate.mockImplementation(async () => {
      steps.push("findOrCreate");
      return mock<TemplatePublisherOutput>();
    });
    const acceptances = mock<TemplateTermsAcceptanceRepository>();
    acceptances.record.mockImplementation(async () => {
      steps.push("recordAcceptance");
    });
    const stripeTransactionRepository = mock<StripeTransactionRepository>();
    stripeTransactionRepository.hasSucceededPayment.mockResolvedValue(input.hasPaid ?? true);

    const marketplaceTemplateService = mock<MarketplaceTemplateService>();
    marketplaceTemplateService.getTemplate.mockImplementation(async () => {
      steps.push("getTemplate");
      return mock<MarketplaceTemplateOutput>();
    });
    const templateWriteAccessService = mock<TemplateWriteAccessService>();
    templateWriteAccessService.findWritable.mockImplementation(async () => {
      steps.push("findWritable");
      return template;
    });
    templateWriteAccessService.lockWritable.mockImplementation(async () => {
      steps.push("lockWritable");
      return input.locked ? mock<MarketplaceTemplateRow>({ id: template.id, title: template.title, projectId: template.projectId, ...input.locked }) : template;
    });
    const publishChecksService = mock<PublishChecksService>();
    publishChecksService.run.mockResolvedValue(input.checkResults ?? PASSED_CHECKS);
    const templateRateLimiterService = mock<TemplateRateLimiterService>();
    templateRateLimiterService.assertWithinLimits.mockImplementation(async () => {
      steps.push("assertWithinLimits");
    });
    const txService = mock<TxService>({
      transaction: vi.fn(async callback => {
        steps.push("begin");
        const result = await callback();
        steps.push("end");
        return result;
      })
    });
    const service = new TemplatePublishService(
      templates,
      versions,
      publishers,
      acceptances,
      stripeTransactionRepository,
      marketplaceTemplateService,
      templateWriteAccessService,
      publishChecksService,
      templateRateLimiterService,
      authService,
      txService
    );

    return {
      service,
      template,
      version,
      user,
      steps,
      repositories: { templates, versions, publishers, acceptances },
      stripeTransactionRepository,
      marketplaceTemplateService,
      templateWriteAccessService,
      publishChecksService,
      templateRateLimiterService,
      txService
    };
  }
});
