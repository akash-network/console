import { eq } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { TxService } from "@src/core/services";

type Table = ApiPgTables["TemplateImageChanges"];

export type TemplateImageChangeOutput = Table["$inferSelect"];

export type DetectedImageChange = Pick<Table["$inferInsert"], "templateId" | "templateVersionId" | "image" | "oldDigest" | "newDigest">;

/** Written here when a digest moves and resolved by the admin app, so it is read across organizations and carries no ability rules. */
@singleton()
export class TemplateImageChangeRepository {
  constructor(
    @InjectPg() private readonly pg: ApiPgDatabase,
    @InjectPgTable("TemplateImageChanges") private readonly table: Table,
    private readonly txManager: TxService
  ) {}

  get #cursor() {
    return this.txManager.getPgTx() || this.pg;
  }

  /** Answers whether the change was new, since one image of one template waits in the staff queue once however often it is seen again. */
  async recordOpen(change: DetectedImageChange): Promise<boolean> {
    const recorded = await this.#cursor
      .insert(this.table)
      .values(change)
      .onConflictDoNothing({ target: [this.table.templateId, this.table.image], where: eq(this.table.status, "open") })
      .returning({ id: this.table.id });

    return recorded.length > 0;
  }

  async findByTemplateId(templateId: string): Promise<TemplateImageChangeOutput[]> {
    return await this.#cursor.select().from(this.table).where(eq(this.table.templateId, templateId)).orderBy(this.table.detectedAt, this.table.image);
  }
}
