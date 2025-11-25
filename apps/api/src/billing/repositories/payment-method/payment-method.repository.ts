import { and, count, eq, inArray, ne, sql } from "drizzle-orm";
import { singleton } from "tsyringe";
import { uuidv4 } from "unleash-client/lib/uuidv4";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { type ApiTransaction, TxService } from "@src/core/services";

type Table = ApiPgTables["PaymentMethods"];
export type PaymentMethodInput = ApiPgTables["PaymentMethods"]["$inferInsert"];
export type PaymentMethodOutput = ApiPgTables["PaymentMethods"]["$inferSelect"];

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

  async findOthersTrialingByFingerprint(fingerprints: string[], userId: string) {
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
        where: this.whereAccessibleBy(and(eq(this.table.userId, userId), eq(this.table.isValidated, true)))
      })
    );
  }

  async markAsValidated(paymentMethodId: string, userId: string) {
    return await this.updateBy({ paymentMethodId, userId }, { isValidated: true });
  }

  async countByUserId(userId: PaymentMethodOutput["userId"]) {
    const [result] = await this.cursor
      .select({ count: count() })
      .from(this.table)
      .where(this.whereAccessibleBy(eq(this.table.userId, userId)));

    return result?.count ?? 0;
  }

  async findDefaultByUserId(userId: PaymentMethodInput["userId"]) {
    return this.findOneBy({ userId, isDefault: true });
  }

  async markAsDefault(paymentMethodId: string) {
    return this.ensureTransaction(async tx => {
      const [output] = await tx
        .update(this.table)
        .set({
          isDefault: true,
          updatedAt: sql`now()`
        })
        .where(this.queryToWhere({ paymentMethodId }))
        .returning();

      if (output) {
        await this.#unmarkAsDefaultExcluding(output.id, tx);

        return this.toOutput(output);
      }
    });
  }

  async createAsDefault(input: Omit<PaymentMethodInput, "id" | "isDefault">) {
    return this.ensureTransaction(async tx => {
      const id = uuidv4();
      const [output] = await Promise.all([
        this.create({
          ...input,
          isDefault: true,
          id
        }),
        this.#unmarkAsDefaultExcluding(id, tx)
      ]);

      return this.toOutput(output);
    });
  }

  async #unmarkAsDefaultExcluding(excludedId: PaymentMethodOutput["id"], tx: ApiTransaction) {
    await tx
      .update(this.table)
      .set({
        isDefault: false,
        updatedAt: sql`now()`
      })
      .where(and(this.queryToWhere({ isDefault: true }), ne(this.table.id, excludedId)));
  }

  async deleteByFingerprint(fingerprint: string, paymentMethodId: string, userId: string) {
    return await this.deleteBy({ fingerprint, paymentMethodId, userId });
  }
}
