import { and, eq, gte, sql } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { TxService } from "@src/core/services";
import type { TemplateViewKind } from "@src/template-marketplace/model-schemas/template-view-event/template-view-event.schema";

type Table = ApiPgTables["TemplateViewEvents"];

export type TemplateViewInput = Omit<Table["$inferInsert"], "id" | "createdAt">;

export type DailyViewCount = { day: string; kind: TemplateViewKind; viewers: number };

@singleton()
export class TemplateViewEventRepository {
  constructor(
    @InjectPg() private readonly pg: ApiPgDatabase,
    @InjectPgTable("TemplateViewEvents") private readonly table: Table,
    private readonly txManager: TxService
  ) {}

  get #cursor() {
    return this.txManager.getPgTx() || this.pg;
  }

  /** Answers whether the view was new, since the same viewer is counted once a day. */
  async recordOncePerDay(view: TemplateViewInput): Promise<boolean> {
    const recorded = await this.#cursor.insert(this.table).values(view).onConflictDoNothing().returning({ id: this.table.id });

    return recorded.length > 0;
  }

  async countDailyViewers({ templateId, network, since }: { templateId: string; network: string; since: string }): Promise<DailyViewCount[]> {
    return await this.#cursor
      .select({ day: this.table.viewedOn, kind: this.table.kind, viewers: sql<number>`count(*)`.mapWith(Number) })
      .from(this.table)
      .where(and(eq(this.table.templateId, templateId), eq(this.table.network, network), gte(this.table.viewedOn, since)))
      .groupBy(this.table.viewedOn, this.table.kind);
  }
}
