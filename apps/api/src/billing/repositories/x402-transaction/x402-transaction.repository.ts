import { eq } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";

type Table = ApiPgTables["X402Transactions"];
export type X402TransactionInput = Table["$inferInsert"];
export type X402TransactionOutput = Table["$inferSelect"];

export type X402TransactionStatus = X402TransactionOutput["status"];

@singleton()
export class X402TransactionRepository extends BaseRepository<Table, X402TransactionInput, X402TransactionOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("X402Transactions") protected readonly table: Table,
    protected readonly txManager: TxService
  ) {
    super(pg, table, txManager, "X402Transaction", "X402Transactions");
  }

  accessibleBy(...abilityParams: AbilityParams) {
    return new X402TransactionRepository(this.pg, this.table, this.txManager).withAbility(...abilityParams) as this;
  }

  async findByPaymentHash(paymentHash: string): Promise<X402TransactionOutput | undefined> {
    const item = await this.cursor.query.X402Transactions.findFirst({
      where: this.whereAccessibleBy(eq(this.table.paymentHash, paymentHash))
    });

    return item ? this.toOutput(item) : undefined;
  }
}
