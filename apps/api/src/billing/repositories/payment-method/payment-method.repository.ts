import { and, eq, inArray, ne } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
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

  async findOthersByFingerprint(fingerprints: string[], userId: string) {
    const item = await this.cursor.query.PaymentMethods.findMany({
      where: this.whereAccessibleBy(and(inArray(this.table.fingerprint, fingerprints), ne(this.table.userId, userId))),
      with: {
        user: {
          with: {
            userWallets: {
              columns: {
                isTrialing: true
              }
            }
          }
        }
      }
    });

    if (item && item.some(item => item.user?.userWallets?.isTrialing)) {
      return this.toOutputList(item);
    }

    return undefined;
  }

  async findByUserId(userId: PaymentMethodOutput["userId"]) {
    return this.toOutputList(
      await this.cursor.query.PaymentMethods.findMany({
        where: this.whereAccessibleBy(eq(this.table.userId, userId))
      })
    );
  }

  async findValidatedByUserId(userId: PaymentMethodOutput["userId"]) {
    return this.toOutputList(
      await this.cursor.query.PaymentMethods.findMany({
        where: this.whereAccessibleBy(and(eq(this.table.userId, userId), eq(this.table.is_validated, true)))
      })
    );
  }

  async markAsValidated(paymentMethodId: string, userId: string) {
    return await this.updateBy({ paymentMethodId, userId }, { is_validated: true });
  }

  async deleteByFingerprint(fingerprint: string, paymentMethodId: string, userId: string) {
    return await this.deleteBy({ fingerprint, paymentMethodId, userId });
  }
}
