import { eq, sql } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";

type Table = ApiPgTables["EmailVerificationCodes"];
export type EmailVerificationCodeInput = Partial<Table["$inferInsert"]>;
export type EmailVerificationCodeDbOutput = Table["$inferSelect"];

export type EmailVerificationCodeOutput = Omit<EmailVerificationCodeDbOutput, "expiresAt" | "createdAt"> & {
  expiresAt: string;
  createdAt: string;
};

@singleton()
export class EmailVerificationCodeRepository extends BaseRepository<Table, EmailVerificationCodeInput, EmailVerificationCodeOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("EmailVerificationCodes") protected readonly table: Table,
    protected readonly txManager: TxService
  ) {
    super(pg, table, txManager, "EmailVerificationCode", "EmailVerificationCodes");
  }

  accessibleBy(...abilityParams: AbilityParams) {
    return new EmailVerificationCodeRepository(this.pg, this.table, this.txManager).withAbility(...abilityParams) as this;
  }

  async upsert(data: { userId: string; email: string; code: string; expiresAt: Date }): Promise<EmailVerificationCodeOutput> {
    const [result] = await this.cursor
      .insert(this.table)
      .values({
        userId: data.userId,
        email: data.email,
        code: data.code,
        expiresAt: data.expiresAt,
        attempts: 0
      })
      .onConflictDoUpdate({
        target: this.table.userId,
        set: {
          email: data.email,
          code: data.code,
          expiresAt: data.expiresAt,
          attempts: 0,
          createdAt: sql`now()`
        }
      })
      .returning();

    return this.toOutput(result);
  }

  async findByUserId(userId: string): Promise<EmailVerificationCodeOutput | undefined> {
    const [result] = await this.cursor.select().from(this.table).where(eq(this.table.userId, userId));

    return result ? this.toOutput(result) : undefined;
  }

  async findByUserIdForUpdate(userId: string): Promise<EmailVerificationCodeOutput | undefined> {
    const [result] = await this.cursor.select().from(this.table).where(eq(this.table.userId, userId)).for("update");

    return result ? this.toOutput(result) : undefined;
  }

  async incrementAttempts(id: string): Promise<void> {
    await this.cursor
      .update(this.table)
      .set({ attempts: sql`${this.table.attempts} + 1` })
      .where(eq(this.table.id, id));
  }

  protected toOutput(payload: EmailVerificationCodeDbOutput): EmailVerificationCodeOutput {
    return {
      ...payload,
      expiresAt: payload.expiresAt.toISOString(),
      createdAt: payload.createdAt.toISOString()
    };
  }
}
