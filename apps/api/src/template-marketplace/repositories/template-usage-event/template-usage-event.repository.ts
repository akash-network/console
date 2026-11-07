import { eq, isNotNull } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { TxService } from "@src/core/services";

type Table = ApiPgTables["TemplateUsageEvents"];
type TemplateVersionsTable = ApiPgTables["TemplateVersions"];

export type TemplateUsageEventInput = Omit<Table["$inferInsert"], "id" | "createdAt">;

@singleton()
export class TemplateUsageEventRepository {
  constructor(
    @InjectPg() private readonly pg: ApiPgDatabase,
    @InjectPgTable("TemplateUsageEvents") private readonly table: Table,
    @InjectPgTable("TemplateVersions") private readonly templateVersions: TemplateVersionsTable,
    private readonly txManager: TxService
  ) {}

  get #cursor() {
    return this.txManager.getPgTx() || this.pg;
  }

  /** Answers whether the event was new, since a deployment records each action once however often its create or lease settles. */
  async record(event: TemplateUsageEventInput): Promise<boolean> {
    const recorded = await this.#cursor
      .insert(this.table)
      .values(event)
      .onConflictDoNothing({ target: [this.table.deploymentSettingId, this.table.action], where: isNotNull(this.table.deploymentSettingId) })
      .returning({ id: this.table.id });

    return recorded.length > 0;
  }

  async findTemplateIdOfVersion(versionId: string): Promise<string | undefined> {
    const [version] = await this.#cursor
      .select({ templateId: this.templateVersions.templateId })
      .from(this.templateVersions)
      .where(eq(this.templateVersions.id, versionId));

    return version?.templateId;
  }
}
