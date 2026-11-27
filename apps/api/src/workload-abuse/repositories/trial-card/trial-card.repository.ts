import { eq } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";

type Table = ApiPgTables["TrialCards"];
export type TrialCardInput = Partial<Table["$inferInsert"]>;
export type TrialCardOutput = Table["$inferSelect"];

@singleton()
export class TrialCardRepository extends BaseRepository<Table, TrialCardInput, TrialCardOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("TrialCards") protected readonly table: Table,
    protected readonly txManager: TxService
  ) {
    super(pg, table, txManager, "TrialCard", "TrialCards");
  }

  accessibleBy(...abilityParams: AbilityParams) {
    return new TrialCardRepository(this.pg, this.table, this.txManager).withAbility(...abilityParams) as this;
  }

  async existsForUser(userId: TrialCardOutput["userId"]): Promise<boolean> {
    return !!(await this.#findByUserId(userId));
  }

  /** The unique indexes decide who gets a card: the row that comes back is the caller's own, or the one of the account that spent the card first. */
  async claim(input: Pick<TrialCardOutput, "cardHash" | "userId">): Promise<TrialCardOutput> {
    const [created] = await this.cursor.insert(this.table).values(input).onConflictDoNothing().returning();
    if (created) return this.toOutput(created);

    const holder = (await this.#findByUserId(input.userId)) ?? (await this.#findByCardHash(input.cardHash));
    if (!holder) throw new Error("A trial card claim met a conflict but no row holds the card or the user");

    return holder;
  }

  async #findByUserId(userId: TrialCardOutput["userId"]): Promise<TrialCardOutput | undefined> {
    const [row] = await this.cursor
      .select()
      .from(this.table)
      .where(this.whereAccessibleBy(eq(this.table.userId, userId)))
      .limit(1);

    return row && this.toOutput(row);
  }

  async #findByCardHash(cardHash: TrialCardOutput["cardHash"]): Promise<TrialCardOutput | undefined> {
    const [row] = await this.cursor
      .select()
      .from(this.table)
      .where(this.whereAccessibleBy(eq(this.table.cardHash, cardHash)))
      .limit(1);

    return row && this.toOutput(row);
  }
}
