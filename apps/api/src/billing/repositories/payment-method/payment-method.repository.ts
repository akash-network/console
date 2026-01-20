import { and, count, eq, inArray, ne, sql } from "drizzle-orm";
import { singleton } from "tsyringe";
import { uuidv4 } from "unleash-client/lib/uuidv4";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository, isUniqueViolation } from "@src/core/repositories/base.repository";
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
      const nextDefaultQuery = this.queryToWhere({ paymentMethodId });
      const nextDefault = await tx.query.PaymentMethods.findFirst({ where: nextDefaultQuery, columns: { id: true } });

      if (!nextDefault) {
        return;
      }

      await this.#unmarkAsDefaultExcluding(nextDefault.id, tx);

      const [output] = await tx
        .update(this.table)
        .set({
          isDefault: true,
          updatedAt: sql`now()`
        })
        .where(nextDefaultQuery)
        .returning();

      return output ? this.toOutput(output) : undefined;
    });
  }

  async createAsDefault(input: Omit<PaymentMethodInput, "id" | "isDefault">) {
    return this.ensureTransaction(async tx => {
      const id = uuidv4();
      await this.#unmarkAsDefaultExcluding(id, tx);

      const output = await this.create({
        ...input,
        isDefault: true,
        id
      });

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

  /**
   * Upserts a payment method - gets existing or creates new.
   * Handles idempotency for webhook retries using onConflictDoNothing.
   * Automatically sets isDefault=true if this is the user's first payment method.
   *
   * Also handles race conditions where two concurrent requests both try to set isDefault=true,
   * which would violate the partial unique constraint on (userId, isDefault) WHERE isDefault=true.
   */
  async upsert(input: { userId: string; fingerprint: string; paymentMethodId: string }): Promise<{ paymentMethod: PaymentMethodOutput; isNew: boolean }> {
    // Check if already exists (idempotency fast path)
    const existing = await this.findOneBy({
      fingerprint: input.fingerprint,
      paymentMethodId: input.paymentMethodId
    });

    if (existing) {
      return { paymentMethod: existing, isNew: false };
    }

    // Determine isDefault BEFORE insert - first payment method for user should be default
    const existingCount = await this.countByUserId(input.userId);
    const isDefault = existingCount === 0;

    try {
      const [newRecord] = await this.cursor
        .insert(this.table)
        .values({
          ...input,
          isDefault
        })
        .onConflictDoNothing({
          target: [this.table.fingerprint, this.table.paymentMethodId]
        })
        .returning();

      if (newRecord) {
        return { paymentMethod: this.toOutput(newRecord), isNew: true };
      }
    } catch (error) {
      // Handle race condition: another request set isDefault=true for this user concurrently,
      // violating the partial unique constraint on (userId, isDefault) WHERE isDefault=true.
      // In this case, retry the insert with isDefault=false.
      if (isUniqueViolation(error)) {
        const [retryRecord] = await this.cursor
          .insert(this.table)
          .values({
            ...input,
            isDefault: false
          })
          .onConflictDoNothing({
            target: [this.table.fingerprint, this.table.paymentMethodId]
          })
          .returning();

        if (retryRecord) {
          return { paymentMethod: this.toOutput(retryRecord), isNew: true };
        }
      } else {
        throw error;
      }
    }

    // Race condition: record was created by a concurrent request
    const paymentMethod = await this.findOneBy({
      fingerprint: input.fingerprint,
      paymentMethodId: input.paymentMethodId
    });

    if (!paymentMethod) {
      throw new Error(
        `Payment method not found after upsert conflict resolution. ` + `fingerprint: ${input.fingerprint}, paymentMethodId: ${input.paymentMethodId}`
      );
    }

    return { paymentMethod, isNew: false };
  }
}
