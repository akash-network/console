import { and, eq, ne, sql } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { TxService } from "@src/core/services";

type BalanceSnapshotsTable = ApiPgTables["BalanceSnapshots"];

type BalanceSnapshotGrantsTable = ApiPgTables["BalanceSnapshotGrants"];

export type BalanceSnapshotOutput = BalanceSnapshotsTable["$inferSelect"];

export type BalanceSnapshotDay = Pick<BalanceSnapshotOutput, "network" | "takenOn">;

export type BalanceSnapshotGrant = Pick<BalanceSnapshotGrantsTable["$inferInsert"], "granter" | "grantee" | "denom" | "amount">;

@singleton()
export class BalanceSnapshotRepository {
  constructor(
    @InjectPg() private readonly pg: ApiPgDatabase,
    @InjectPgTable("BalanceSnapshots") private readonly table: BalanceSnapshotsTable,
    @InjectPgTable("BalanceSnapshotGrants") private readonly grants: BalanceSnapshotGrantsTable,
    private readonly txManager: TxService
  ) {}

  get #cursor() {
    return this.txManager.getPgTx() || this.pg;
  }

  async findByDay({ network, takenOn }: BalanceSnapshotDay): Promise<BalanceSnapshotOutput | undefined> {
    const [snapshot] = await this.#cursor
      .select()
      .from(this.table)
      .where(and(eq(this.table.network, network), eq(this.table.takenOn, takenOn)));

    return snapshot;
  }

  /** Starts the day's snapshot over at a new height unless it is already complete, in which case nothing is returned and nothing changes. */
  async startUnlessComplete(day: BalanceSnapshotDay & { height: number }): Promise<BalanceSnapshotOutput | undefined> {
    return await this.txManager.transaction(async () => {
      const [snapshot] = await this.#cursor
        .insert(this.table)
        .values({ ...day, status: "running" })
        .onConflictDoUpdate({
          target: [this.table.network, this.table.takenOn],
          set: { status: "running", height: day.height, grantsCount: null, failure: null, updatedAt: sql`now()` },
          setWhere: ne(this.table.status, "complete")
        })
        .returning();

      if (snapshot) await this.#cursor.delete(this.grants).where(eq(this.grants.snapshotId, snapshot.id));

      return snapshot;
    });
  }

  async addGrants(snapshotId: BalanceSnapshotOutput["id"], grants: BalanceSnapshotGrant[]): Promise<void> {
    if (grants.length === 0) return;

    await this.#cursor.insert(this.grants).values(grants.map(grant => ({ ...grant, snapshotId })));
  }

  async findGrants(snapshotId: BalanceSnapshotOutput["id"]): Promise<BalanceSnapshotGrant[]> {
    return await this.#cursor
      .select({ granter: this.grants.granter, grantee: this.grants.grantee, denom: this.grants.denom, amount: this.grants.amount })
      .from(this.grants)
      .where(eq(this.grants.snapshotId, snapshotId))
      .orderBy(this.grants.granter, this.grants.grantee, this.grants.denom);
  }

  async complete(id: BalanceSnapshotOutput["id"], grantsCount: number): Promise<void> {
    await this.#cursor
      .update(this.table)
      .set({ status: "complete", grantsCount, updatedAt: sql`now()` })
      .where(eq(this.table.id, id));
  }

  async fail(id: BalanceSnapshotOutput["id"], failure: string): Promise<void> {
    await this.#cursor
      .update(this.table)
      .set({ status: "failed", failure, updatedAt: sql`now()` })
      .where(eq(this.table.id, id));
  }
}
