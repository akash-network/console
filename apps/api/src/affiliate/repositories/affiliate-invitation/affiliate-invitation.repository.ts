import { eq } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { TxService } from "@src/core/services";

type Table = ApiPgTables["AffiliateInvitations"];

@singleton()
export class AffiliateInvitationRepository {
  constructor(
    @InjectPg() private readonly pg: ApiPgDatabase,
    @InjectPgTable("AffiliateInvitations") private readonly table: Table,
    private readonly txManager: TxService
  ) {}

  get #cursor() {
    return this.txManager.getPgTx() || this.pg;
  }

  /** Answers false when a committed invitation already holds the person, so a later job for them sends nothing. */
  async claim(userId: string, sentAt: Date): Promise<boolean> {
    const claimed = await this.#cursor
      .insert(this.table)
      .values({ userId, sentAt })
      .onConflictDoNothing({ target: this.table.userId })
      .returning({ userId: this.table.userId });

    return claimed.length > 0;
  }

  async release(userId: string): Promise<void> {
    await this.#cursor.delete(this.table).where(eq(this.table.userId, userId));
  }

  async findByUserId(userId: string): Promise<{ userId: string; sentAt: Date } | undefined> {
    const [invitation] = await this.#cursor
      .select({ userId: this.table.userId, sentAt: this.table.sentAt })
      .from(this.table)
      .where(eq(this.table.userId, userId));

    return invitation;
  }
}
