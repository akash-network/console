import { eq, sql } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { TxService } from "@src/core/services";

type Table = ApiPgTables["GpuWaitlistPools"];
export type GpuWaitlistPoolInput = Table["$inferInsert"];
export type GpuWaitlistPoolRow = Table["$inferSelect"];

@singleton()
export class GpuWaitlistPoolRepository {
  constructor(
    @InjectPg() private readonly pg: ApiPgDatabase,
    @InjectPgTable("GpuWaitlistPools") private readonly table: Table,
    private readonly txManager: TxService
  ) {}

  get #cursor() {
    return this.txManager.getPgTx() || this.pg;
  }

  async findByPoolKeyAndLock(poolKey: string): Promise<GpuWaitlistPoolRow | undefined> {
    const [pool] = await this.#cursor.select().from(this.table).where(eq(this.table.poolKey, poolKey)).for("update");

    return pool;
  }

  async upsert(input: GpuWaitlistPoolInput): Promise<void> {
    const { poolKey, ...values } = input;

    await this.#cursor
      .insert(this.table)
      .values(input)
      .onConflictDoUpdate({ target: this.table.poolKey, set: { ...values, updatedAt: sql`now()` } });
  }

  async update(poolKey: string, values: Partial<Omit<GpuWaitlistPoolInput, "poolKey">>): Promise<void> {
    await this.#cursor
      .update(this.table)
      .set({ ...values, updatedAt: sql`now()` })
      .where(eq(this.table.poolKey, poolKey));
  }
}
