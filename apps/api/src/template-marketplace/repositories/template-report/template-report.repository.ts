import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { TxService } from "@src/core/services";
import type { TemplateReportReason } from "@src/template-marketplace/model-schemas/template-report/template-report.schema";

type Table = ApiPgTables["TemplateReports"];

export type NewTemplateReport = {
  templateId: string;
  templateVersionId: string;
  reporterUserId: string;
  reporterOrganizationId: string;
  reason: TemplateReportReason;
  details: string | null;
};

export type FiledTemplateReport = { id: string; reason: TemplateReportReason; createdAt: Date };

/** Writes only: staff read and resolve reports from the admin app, and no user-facing route may read who filed one. */
@singleton()
export class TemplateReportRepository {
  constructor(
    @InjectPg() private readonly pg: ApiPgDatabase,
    @InjectPgTable("TemplateReports") private readonly table: Table,
    private readonly txManager: TxService
  ) {}

  /** Answers nothing when the reporter already reported this version of the template. */
  async fileUnlessReported(report: NewTemplateReport): Promise<FiledTemplateReport | undefined> {
    const cursor = this.txManager.getPgTx() || this.pg;
    const [filed] = await cursor
      .insert(this.table)
      .values(report)
      .onConflictDoNothing({ target: [this.table.templateId, this.table.templateVersionId, this.table.reporterUserId] })
      .returning({ id: this.table.id, reason: this.table.reason, createdAt: this.table.createdAt });

    return filed;
  }
}
