import { and, count, eq, ne, sql } from "drizzle-orm";
import { singleton } from "tsyringe";
import { uuidv4 } from "unleash-client/lib/uuidv4";

import { type BillingOwner, ownedBy } from "@src/billing/lib/billing-owner/billing-owner";
import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { isUniqueViolation } from "@src/core/repositories/base.repository";
import { OrgScopedRepository } from "@src/core/repositories/org-scoped.repository";
import { type ApiTransaction, TxService } from "@src/core/services";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";

type Table = ApiPgTables["PaymentMethods"];
export type PaymentMethodInput = ApiPgTables["PaymentMethods"]["$inferInsert"];
export type PaymentMethodOutput = ApiPgTables["PaymentMethods"]["$inferSelect"];

@singleton()
export class PaymentMethodRepository extends OrgScopedRepository<Table, PaymentMethodInput, PaymentMethodOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("PaymentMethods") protected readonly table: Table,
    protected readonly txManager: TxService,
    protected readonly executionContextService: ExecutionContextService
  ) {
    super(pg, table, txManager, executionContextService, "PaymentMethod", "PaymentMethods");
  }

  protected newInstance() {
    return new PaymentMethodRepository(this.pg, this.table, this.txManager, this.executionContextService) as this;
  }

  async findByOwner(owner: BillingOwner): Promise<PaymentMethodOutput[]> {
    const paymentMethods = await this.cursor.select().from(this.table).where(this.whereAccessibleBy(ownedBy(this.table, owner)));
    this.compareWithShadow(paymentMethods);

    return this.toOutputList(paymentMethods);
  }

  async findOneOwnedBy(owner: BillingOwner, paymentMethodId: string): Promise<PaymentMethodOutput | undefined> {
    const [paymentMethod] = await this.cursor
      .select()
      .from(this.table)
      .where(this.whereAccessibleBy(and(ownedBy(this.table, owner), eq(this.table.paymentMethodId, paymentMethodId))))
      .limit(1);

    return paymentMethod && this.toOutput(paymentMethod);
  }

  async findDefaultByOwner(owner: BillingOwner): Promise<PaymentMethodOutput | undefined> {
    const [paymentMethod] = await this.cursor
      .select()
      .from(this.table)
      .where(this.whereAccessibleBy(and(ownedBy(this.table, owner), eq(this.table.isDefault, true))))
      .limit(1);

    return paymentMethod && this.toOutput(paymentMethod);
  }

  async markAsValidated(paymentMethodId: string, owner: BillingOwner) {
    await this.updateWhere(this.whereAccessibleBy(and(ownedBy(this.table, owner), eq(this.table.paymentMethodId, paymentMethodId))), { isValidated: true });
  }

  async countByOwner(owner: BillingOwner) {
    const [result] = await this.cursor
      .select({ count: count() })
      .from(this.table)
      .where(this.whereAccessibleBy(ownedBy(this.table, owner)));

    return result?.count ?? 0;
  }

  async markAsDefault(paymentMethodId: string, owner: BillingOwner) {
    return this.ensureTransaction(async tx => {
      const nextDefaultQuery = this.whereAccessibleBy(and(ownedBy(this.table, owner), eq(this.table.paymentMethodId, paymentMethodId)));
      const [nextDefault] = await tx.select({ id: this.table.id }).from(this.table).where(nextDefaultQuery).limit(1);

      if (!nextDefault) {
        return;
      }

      await this.#unmarkAsDefaultExcluding(nextDefault.id, owner, tx);

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

  async createAsDefault({ owner, ...input }: Omit<PaymentMethodInput, "id" | "isDefault"> & { owner: BillingOwner }) {
    return this.ensureTransaction(async tx => {
      const id = uuidv4();
      await this.#unmarkAsDefaultExcluding(id, owner, tx);

      const output = await this.create({
        ...input,
        isDefault: true,
        id
      });

      return this.toOutput(output);
    });
  }

  async #unmarkAsDefaultExcluding(excludedId: PaymentMethodOutput["id"], owner: BillingOwner, tx: ApiTransaction) {
    await tx
      .update(this.table)
      .set({
        isDefault: false,
        updatedAt: sql`now()`
      })
      .where(this.whereAccessibleBy(and(ownedBy(this.table, owner), eq(this.table.isDefault, true), ne(this.table.id, excludedId))));
  }

  async deleteByFingerprint(fingerprint: string, paymentMethodId: string, owner: BillingOwner): Promise<boolean> {
    const deleted = await this.cursor
      .delete(this.table)
      .where(this.whereAccessibleBy(and(ownedBy(this.table, owner), eq(this.table.fingerprint, fingerprint), eq(this.table.paymentMethodId, paymentMethodId))))
      .returning({ id: this.table.id });

    return deleted.length > 0;
  }

  /**
   * Upserts a payment method - gets existing or creates new.
   * Handles idempotency for webhook retries using onConflictDoNothing.
   * Automatically sets isDefault=true if this is the owner's first payment method.
   *
   * Also handles race conditions where two concurrent requests both try to set isDefault=true,
   * which would violate the partial unique constraints allowing one default per owner.
   */
  async upsert({
    owner,
    ...input
  }: {
    userId: string;
    organizationId?: string;
    owner: BillingOwner;
    fingerprint: string;
    paymentMethodId: string;
  }): Promise<{ paymentMethod: PaymentMethodOutput; isNew: boolean }> {
    // Check if already exists (idempotency fast path)
    const existing = await this.#findOwned(owner, input);

    if (existing) {
      return { paymentMethod: existing, isNew: false };
    }

    // Determine isDefault BEFORE insert - first payment method for the owner should be default
    const existingCount = await this.countByOwner(owner);
    const isDefault = existingCount === 0;

    try {
      const [newRecord] = await this.cursor
        .insert(this.table)
        .values(
          await this.attributeToOrganization({
            ...input,
            isDefault
          })
        )
        .onConflictDoNothing({
          target: [this.table.fingerprint, this.table.paymentMethodId]
        })
        .returning();

      if (newRecord) {
        return { paymentMethod: this.toOutput(newRecord), isNew: true };
      }
    } catch (error) {
      // Handle race condition: another request set isDefault=true for this owner concurrently,
      // violating a partial unique constraint on its default payment method.
      // In this case, retry the insert with isDefault=false.
      if (isUniqueViolation(error)) {
        const [retryRecord] = await this.cursor
          .insert(this.table)
          .values(
            await this.attributeToOrganization({
              ...input,
              isDefault: false
            })
          )
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
    const paymentMethod = await this.#findOwned(owner, input);

    return { paymentMethod: this.requireWrittenRow(paymentMethod), isNew: false };
  }

  async #findOwned(owner: BillingOwner, input: { fingerprint: string; paymentMethodId: string }): Promise<PaymentMethodOutput | undefined> {
    const [paymentMethod] = await this.cursor
      .select()
      .from(this.table)
      .where(
        this.whereAccessibleBy(
          and(ownedBy(this.table, owner), eq(this.table.fingerprint, input.fingerprint), eq(this.table.paymentMethodId, input.paymentMethodId))
        )
      )
      .limit(1);

    return paymentMethod && this.toOutput(paymentMethod);
  }
}
