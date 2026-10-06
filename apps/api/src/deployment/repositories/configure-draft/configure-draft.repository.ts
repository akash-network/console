import { and, desc, eq, notInArray, sql } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";
import type { ConfigureDraftContent } from "@src/deployment/model-schemas";

type Table = ApiPgTables["ConfigureDrafts"];
export type ConfigureDraftInput = Partial<Table["$inferInsert"]>;
export type ConfigureDraftOutput = Table["$inferSelect"];

@singleton()
export class ConfigureDraftRepository extends BaseRepository<Table, ConfigureDraftInput, ConfigureDraftOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("ConfigureDrafts") protected readonly table: Table,
    protected readonly txManager: TxService
  ) {
    super(pg, table, txManager, "ConfigureDraft", "ConfigureDrafts");
  }

  accessibleBy(...abilityParams: AbilityParams) {
    return new ConfigureDraftRepository(this.pg, this.table, this.txManager).withAbility(...abilityParams) as this;
  }

  async findByDraftId(draftId: string): Promise<ConfigureDraftOutput | undefined> {
    const [draft] = await this.cursor
      .select()
      .from(this.table)
      .where(this.whereAccessibleBy(eq(this.table.draftId, draftId)));

    return draft;
  }

  /** Tells a new draft from a replaced one by whether the insert took, so only a new draft is given an expiry. */
  async createOrReplace(input: { userId: string; draftId: string; content: ConfigureDraftContent }): Promise<{ draft: ConfigureDraftOutput; isNew: boolean }> {
    this.ability?.throwUnlessCanExecute(input);

    const [created] = await this.cursor
      .insert(this.table)
      .values(input)
      .onConflictDoNothing({ target: [this.table.userId, this.table.draftId] })
      .returning();
    if (created) return { draft: created, isNew: true };

    const [replaced] = await this.cursor
      .update(this.table)
      .set({ content: input.content, updatedAt: sql`now()` })
      .where(and(eq(this.table.userId, input.userId), eq(this.table.draftId, input.draftId)))
      .returning();

    return { draft: replaced, isNew: false };
  }

  /** Keeps the user's most recently saved drafts and drops the rest, the way the browser bounded them before. */
  async deleteAllButNewest(userId: string, kept: number): Promise<void> {
    const newest = this.cursor
      .select({ id: this.table.id })
      .from(this.table)
      .where(eq(this.table.userId, userId))
      .orderBy(desc(this.table.updatedAt), desc(this.table.id))
      .limit(kept);

    await this.cursor.delete(this.table).where(and(eq(this.table.userId, userId), notInArray(this.table.id, newest)));
  }
}
