import { faker } from "@faker-js/faker";
import createError from "http-errors";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { TxService } from "@src/core/services";
import type { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type {
  MembershipWithProjectAccess,
  OrganizationMemberRepository
} from "@src/organization/repositories/organization-member/organization-member.repository";
import type {
  MarketplaceTemplateRepository,
  MarketplaceTemplateRow,
  ReportableTemplate
} from "@src/template-marketplace/repositories/marketplace-template/marketplace-template.repository";
import type { FiledTemplateReport, TemplateReportRepository } from "@src/template-marketplace/repositories/template-report/template-report.repository";
import type { MarketplaceTemplateService } from "@src/template-marketplace/services/marketplace-template/marketplace-template.service";
import type { TemplateRateLimiterService } from "@src/template-marketplace/services/template-rate-limiter/template-rate-limiter.service";
import type { UserOutput } from "@src/user/repositories";
import { TemplateReportService } from "./template-report.service";

import { createOrganizationContext } from "@test/seeders/organization-context.seeder";

describe(TemplateReportService.name, () => {
  it("files the report against the template's current version, from the reporter and their active organization", async () => {
    const { service, template, reporter, organizationId, filed, templateReportRepository, steps } = setup();

    const result = await service.report(template.id, { reason: "malware_or_miner", details: "It downloads a miner." });

    expect(result).toBe(filed);
    expect(templateReportRepository.fileUnlessReported).toHaveBeenCalledWith({
      templateId: template.id,
      templateVersionId: template.currentVersionId,
      reporterUserId: reporter.id,
      reporterOrganizationId: organizationId,
      reason: "malware_or_miner",
      details: "It downloads a miner."
    });
    expect(steps).toEqual(["findReadable", "findPubliclyReadable", "findActiveMembership", "begin", "assertWithinLimits", "fileUnlessReported", "end"]);
  });

  it.each([undefined, ""])("files a report whose details are %j without details", async details => {
    const { service, template, templateReportRepository } = setup();

    await service.report(template.id, { reason: "spam", details });

    expect(templateReportRepository.fileUnlessReported).toHaveBeenCalledWith(expect.objectContaining({ details: null }));
  });

  it("holds the reporter and their organization to the report limits inside the transaction that files it", async () => {
    const { service, template, reporter, organizationId, templateRateLimiterService } = setup();

    await service.report(template.id, { reason: "spam" });

    expect(templateRateLimiterService.assertWithinLimits).toHaveBeenCalledWith("report", { userId: reporter.id, organizationId });
  });

  it("refuses a caller acting for no organization", async () => {
    const { service, template, marketplaceTemplateService } = setup({ organizationId: null });

    await expect(service.report(template.id, { reason: "spam" })).rejects.toMatchObject({ status: 403, message: "You cannot report templates" });
    expect(marketplaceTemplateService.findReadable).not.toHaveBeenCalled();
  });

  it("answers what reading the template answers when the caller may not read it", async () => {
    const notFound = createError(404, "Template not found");
    const { service, template, marketplaceTemplateRepository } = setup({ readError: notFound });

    await expect(service.report(template.id, { reason: "spam" })).rejects.toBe(notFound);
    expect(marketplaceTemplateRepository.findPubliclyReadable).not.toHaveBeenCalled();
  });

  it("refuses a template the caller may read but the public may not", async () => {
    const { service, template, templateReportRepository, organizationMemberRepository } = setup({ reportable: null });

    await expect(service.report(template.id, { reason: "spam" })).rejects.toMatchObject({
      status: 409,
      message: "Only public templates can be reported",
      errorCode: "template_not_reportable"
    });
    expect(organizationMemberRepository.findActiveMembership).not.toHaveBeenCalled();
    expect(templateReportRepository.fileUnlessReported).not.toHaveBeenCalled();
  });

  it("refuses a public template that has no version to report", async () => {
    const { service, template } = setup({ reportable: { currentVersionId: null } });

    await expect(service.report(template.id, { reason: "spam" })).rejects.toMatchObject({ status: 409, errorCode: "template_not_reportable" });
  });

  it("refuses a member of the organization that published the template, whichever organization is active", async () => {
    const { service, template, reporter, organizationMemberRepository, templateReportRepository, txService } = setup({ isPublisherMember: true });

    await expect(service.report(template.id, { reason: "spam" })).rejects.toMatchObject({
      status: 403,
      message: "You can't report a template your own organization published. Change it or delete it instead.",
      errorCode: "template_report_own_organization"
    });
    expect(organizationMemberRepository.findActiveMembership).toHaveBeenCalledWith(reporter.id, { id: template.organizationId });
    expect(txService.transaction).not.toHaveBeenCalled();
    expect(templateReportRepository.fileUnlessReported).not.toHaveBeenCalled();
  });

  it("files nothing once a report limit is reached", async () => {
    const rateLimited = createError(429, "You reached the limit");
    const { service, template, templateReportRepository } = setup({ rateLimitError: rateLimited });

    await expect(service.report(template.id, { reason: "spam" })).rejects.toBe(rateLimited);
    expect(templateReportRepository.fileUnlessReported).not.toHaveBeenCalled();
  });

  it("refuses a second report of the same version by the same reporter", async () => {
    const { service, template } = setup({ isAlreadyReported: true });

    await expect(service.report(template.id, { reason: "spam" })).rejects.toMatchObject({
      status: 409,
      message: "You already reported this version of the template",
      errorCode: "template_already_reported"
    });
  });

  function setup(
    input: {
      organizationId?: string | null;
      readError?: Error;
      reportable?: Partial<ReportableTemplate> | null;
      isPublisherMember?: boolean;
      rateLimitError?: Error;
      isAlreadyReported?: boolean;
    } = {}
  ) {
    const steps: string[] = [];
    const reporter = mock<UserOutput>({ id: faker.string.uuid() });
    const organizationId = input.organizationId === null ? undefined : input.organizationId ?? faker.string.uuid();
    const template: ReportableTemplate = { id: faker.string.uuid(), organizationId: faker.string.uuid(), currentVersionId: faker.string.uuid() };
    const filed: FiledTemplateReport = { id: faker.string.uuid(), reason: "malware_or_miner", createdAt: new Date() };

    const authService = mock<AuthService>();
    authService.currentUser = reporter;
    const executionContextService = mock<ExecutionContextService>();
    executionContextService.get.calledWith("ORGANIZATION_CONTEXT").mockReturnValue(organizationId ? createOrganizationContext({ organizationId }) : undefined);
    const marketplaceTemplateService = mock<MarketplaceTemplateService>();
    marketplaceTemplateService.findReadable.mockImplementation(async () => {
      steps.push("findReadable");
      if (input.readError) throw input.readError;
      return mock<MarketplaceTemplateRow>();
    });
    const marketplaceTemplateRepository = mock<MarketplaceTemplateRepository>();
    marketplaceTemplateRepository.findPubliclyReadable.mockImplementation(async () => {
      steps.push("findPubliclyReadable");
      return input.reportable === null ? undefined : { ...template, ...input.reportable };
    });
    const organizationMemberRepository = mock<OrganizationMemberRepository>();
    organizationMemberRepository.findActiveMembership.mockImplementation(async () => {
      steps.push("findActiveMembership");
      return input.isPublisherMember ? mock<MembershipWithProjectAccess>() : undefined;
    });
    const templateRateLimiterService = mock<TemplateRateLimiterService>();
    templateRateLimiterService.assertWithinLimits.mockImplementation(async () => {
      steps.push("assertWithinLimits");
      if (input.rateLimitError) throw input.rateLimitError;
    });
    const templateReportRepository = mock<TemplateReportRepository>();
    templateReportRepository.fileUnlessReported.mockImplementation(async () => {
      steps.push("fileUnlessReported");
      return input.isAlreadyReported ? undefined : filed;
    });
    const txService = mock<TxService>({
      transaction: vi.fn(async callback => {
        steps.push("begin");
        const result = await callback();
        steps.push("end");
        return result;
      })
    });
    const service = new TemplateReportService(
      templateReportRepository,
      marketplaceTemplateRepository,
      organizationMemberRepository,
      marketplaceTemplateService,
      templateRateLimiterService,
      authService,
      executionContextService,
      txService
    );

    return {
      service,
      template,
      reporter,
      organizationId,
      filed,
      steps,
      templateReportRepository,
      marketplaceTemplateRepository,
      organizationMemberRepository,
      marketplaceTemplateService,
      templateRateLimiterService,
      txService
    };
  }
});
