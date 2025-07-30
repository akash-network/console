import { and, eq, inArray, ne } from "drizzle-orm";
import { singleton } from "tsyringe";

import { ApiPgDatabase, ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";

type Table = ApiPgTables["PaymentMethods"];
type PaymentMethodInput = ApiPgTables["PaymentMethods"]["$inferInsert"];
type PaymentMethodOutput = ApiPgTables["PaymentMethods"]["$inferSelect"];

@singleton()
export class PaymentMethodRepository extends BaseRepository<Table, PaymentMethodInput, PaymentMethodOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("PaymentMethods") protected readonly table: Table,
    protected readonly txManager: TxService
  ) {
    super(pg, table, txManager, "PaymentMethod", "PaymentMethods");
  }

  accessibleBy(...abilityParams: AbilityParams) {
    return new PaymentMethodRepository(this.pg, this.table, this.txManager).withAbility(...abilityParams) as this;
  }

  async findOtherByFingerprint(fingerprints: string[], userId: string) {
    const item = await this.cursor.query.PaymentMethods.findFirst({
      where: this.whereAccessibleBy(and(inArray(this.table.fingerprint, fingerprints), ne(this.table.userId, userId)))
    });
    return item ? this.toOutput(item) : undefined;
  }

  async findByUserId(userId: PaymentMethodOutput["userId"]) {
    return this.toOutputList(
      await this.cursor.query.PaymentMethods.findMany({
        where: this.whereAccessibleBy(eq(this.table.userId, userId))
      })
    );
  }

  async deleteByFingerprint(fingerprint: string, paymentMethodId: string, userId: string) {
    return await this.deleteBy({ fingerprint, paymentMethodId, userId });
  }
}
