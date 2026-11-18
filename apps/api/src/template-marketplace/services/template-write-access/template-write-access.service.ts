import assert from "http-assert";
import createError from "http-errors";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { ORGANIZATION_FORBIDDEN_ERROR_CODE } from "@src/core/repositories/org-scoped.repository";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { findTemplateWriteRefusal, type TemplateWriteAction } from "@src/template-marketplace/lib/template-write-access/template-write-access";
import {
  MarketplaceTemplateRepository,
  type MarketplaceTemplateRow
} from "@src/template-marketplace/repositories/marketplace-template/marketplace-template.repository";
import { MarketplaceTemplateService } from "@src/template-marketplace/services/marketplace-template/marketplace-template.service";

export type StoredTemplate = Omit<MarketplaceTemplateRow, "authorUsername" | "publisher">;

const TEMPLATE_NOT_FOUND = "Template not found";

@singleton()
export class TemplateWriteAccessService {
  constructor(
    private readonly marketplaceTemplateRepository: MarketplaceTemplateRepository,
    private readonly marketplaceTemplateService: MarketplaceTemplateService,
    private readonly authService: AuthService,
    private readonly executionContextService: ExecutionContextService
  ) {}

  /** Answers 404 for a template the caller may not read, before any 403, so its existence does not leak. */
  async findWritable(id: string, action: TemplateWriteAction): Promise<MarketplaceTemplateRow> {
    const template = await this.marketplaceTemplateService.findReadable(id);
    this.#assertWritable(template, action);

    return template;
  }

  /** The row read before the transaction may since have moved, been re-scoped or deleted, so the write is authorized again on the row it locks. */
  async lockWritable(id: string, action: TemplateWriteAction): Promise<StoredTemplate> {
    const template = await this.marketplaceTemplateRepository.findAndLockForWrite(id);
    assert(template && template.moderationStatus !== "removed", 404, TEMPLATE_NOT_FOUND);
    this.#assertWritable(template, action);

    return template;
  }

  #assertWritable(template: StoredTemplate, action: TemplateWriteAction): void {
    const activeOrganizationId = this.executionContextService.get("ORGANIZATION_CONTEXT")?.organizationId;
    const refusal = findTemplateWriteRefusal(template, action, { ability: this.authService.ability, activeOrganizationId });

    if (refusal === "outside_active_organization") {
      throw createError(403, "Switch to the template's organization to change it", { errorCode: ORGANIZATION_FORBIDDEN_ERROR_CODE });
    }

    assert(!refusal, 403, "You cannot change this template");
  }
}
