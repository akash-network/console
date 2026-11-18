import createError from "http-errors";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { TxService } from "@src/core/services";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { OrganizationMemberRepository } from "@src/organization/repositories/organization-member/organization-member.repository";
import type { TemplateReportReason } from "@src/template-marketplace/model-schemas/template-report/template-report.schema";
import { MarketplaceTemplateRepository } from "@src/template-marketplace/repositories/marketplace-template/marketplace-template.repository";
import { type FiledTemplateReport, TemplateReportRepository } from "@src/template-marketplace/repositories/template-report/template-report.repository";
import { MarketplaceTemplateService } from "@src/template-marketplace/services/marketplace-template/marketplace-template.service";
import { TemplateRateLimiterService } from "@src/template-marketplace/services/template-rate-limiter/template-rate-limiter.service";

export const TEMPLATE_NOT_REPORTABLE_ERROR_CODE = "template_not_reportable";
export const TEMPLATE_REPORT_OWN_ORGANIZATION_ERROR_CODE = "template_report_own_organization";
export const TEMPLATE_ALREADY_REPORTED_ERROR_CODE = "template_already_reported";

export type TemplateReportInput = { reason: TemplateReportReason; details?: string };

@singleton()
export class TemplateReportService {
  constructor(
    private readonly templateReportRepository: TemplateReportRepository,
    private readonly marketplaceTemplateRepository: MarketplaceTemplateRepository,
    private readonly organizationMemberRepository: OrganizationMemberRepository,
    private readonly marketplaceTemplateService: MarketplaceTemplateService,
    private readonly templateRateLimiterService: TemplateRateLimiterService,
    private readonly authService: AuthService,
    private readonly executionContextService: ExecutionContextService,
    private readonly txService: TxService
  ) {}

  /** Files the report against the version that is current now, which is the one the reporter was shown. */
  async report(id: string, { reason, details }: TemplateReportInput): Promise<FiledTemplateReport> {
    const reporterUserId = this.authService.currentUser.id;
    const reporterOrganizationId = this.executionContextService.get("ORGANIZATION_CONTEXT")?.organizationId;

    if (!reporterOrganizationId) throw createError(403, "You cannot report templates");

    await this.marketplaceTemplateService.findReadable(id);
    const template = await this.marketplaceTemplateRepository.findPubliclyReadable(id);

    if (!template?.currentVersionId) {
      throw createError(409, "Only public templates can be reported", { errorCode: TEMPLATE_NOT_REPORTABLE_ERROR_CODE });
    }

    await this.#assertOutsidePublisher(reporterUserId, template.organizationId);
    const templateVersionId = template.currentVersionId;

    return await this.txService.transaction(async () => {
      await this.templateRateLimiterService.assertWithinLimits("report", { userId: reporterUserId, organizationId: reporterOrganizationId });
      const filed = await this.templateReportRepository.fileUnlessReported({
        templateId: id,
        templateVersionId,
        reporterUserId,
        reporterOrganizationId,
        reason,
        details: details || null
      });

      if (!filed) {
        throw createError(409, "You already reported this version of the template", { errorCode: TEMPLATE_ALREADY_REPORTED_ERROR_CODE });
      }

      return filed;
    });
  }

  /** A publisher's own members could otherwise fill the staff queue with reports nobody outside filed. */
  async #assertOutsidePublisher(userId: string, publisherOrganizationId: string): Promise<void> {
    if (await this.organizationMemberRepository.findActiveMembership(userId, { id: publisherOrganizationId })) {
      throw createError(403, "You can't report a template your own organization published. Change it or delete it instead.", {
        errorCode: TEMPLATE_REPORT_OWN_ORGANIZATION_ERROR_CODE
      });
    }
  }
}
