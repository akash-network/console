import { Trace } from "@akashnetwork/instrumentation";
import { and, desc, eq, gte, isNotNull, isNull, lt, ne, or, SQL, sql } from "drizzle-orm";
import { PgUpdateSetSource } from "drizzle-orm/pg-core";
import { singleton } from "tsyringe";

import { UserWallets } from "@src/billing/model-schemas";
import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";
import { userAgentMaxLength } from "@src/user/model-schemas/user/user.schema";

export type UserOutput = ApiPgTables["Users"]["$inferSelect"] & {
  trial?: boolean;
};
export type UserInput = Partial<UserOutput>;

const MAX_LINKED_ACCOUNTS = 20;

@singleton()
export class UserRepository extends BaseRepository<ApiPgTables["Users"], UserInput, UserOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("Users") protected readonly table: ApiPgTables["Users"],
    protected readonly txManager: TxService
  ) {
    super(pg, table, txManager, "User", "Users");
  }

  accessibleBy(...abilityParams: AbilityParams) {
    return new UserRepository(this.pg, this.table, this.txManager).withAbility(...abilityParams) as this;
  }

  async create(input: UserInput = {}): Promise<UserOutput> {
    return await super.create(input);
  }

  @Trace()
  async findById(id: UserOutput["id"]): Promise<UserOutput | undefined> {
    return this.findUserWithWallet(eq(this.table.id, id));
  }

  @Trace()
  async findByUserId(userId: UserOutput["userId"]): Promise<UserOutput | undefined> {
    return this.findUserWithWallet(eq(this.table.userId, userId!));
  }

  /** Skipping and a first accepted create share this timestamp, because it is the one field the onboarding gate lets a user through on. */
  @Trace()
  async markOnboarded(id: UserOutput["id"]): Promise<void> {
    await this.updateBy({ id, onboardingSkippedAt: null }, { onboardingSkippedAt: new Date() });
  }

  @Trace()
  async markAsActive(
    id: UserOutput["id"],
    options: {
      throttleTimeSeconds: number;
      ip?: string;
      fingerprint?: string;
    }
  ): Promise<void> {
    const changes: PgUpdateSetSource<typeof this.table> = {
      lastActiveAt: sql`now()`
    };

    if (options.ip) changes.lastIp = options.ip;
    if (options.fingerprint) changes.lastFingerprint = options.fingerprint;

    await this.cursor
      .update(this.table)
      .set(changes)
      .where(
        and(
          // keep new line
          eq(this.table.id, id),
          or(isNull(this.table.lastActiveAt), lt(this.table.lastActiveAt, sql`now() - make_interval(secs => ${options.throttleTimeSeconds})`))
        )
      );
  }

  async upsertOnExternalIdConflict(data: UserInput): Promise<{ user: UserOutput; wasInserted: boolean }> {
    const { username, ...withoutUsername } = data;
    this.ability?.throwUnlessCanExecute(data);

    // ON CONFLICT DO NOTHING returns a row only to the call whose insert actually created it, so
    // the unique constraint — not a race-prone read-before-write — decides who is the creator.
    const [inserted] = await this.cursor
      .insert(this.table)
      .values(this.toInput(data))
      .onConflictDoNothing({ target: [this.table.userId] })
      .returning();

    if (inserted) {
      return { user: this.toOutput(inserted), wasInserted: true };
    }

    // Existing user: refresh the same mutable fields the previous upsert kept up to date.
    const [updated] = await this.cursor
      .update(this.table)
      .set({ ...withoutUsername, ...this.#addressKeptWhileTerminated(withoutUsername) })
      .where(this.whereAccessibleBy(eq(this.table.userId, data.userId!)))
      .returning();
    if (!updated) {
      // The row existed at INSERT time but is gone now — only possible via a concurrent delete.
      throw new Error(`Failed to upsert user: no row to update for userId ${data.userId}`);
    }
    return { user: this.toOutput(updated), wasInserted: false };
  }

  /** A terminated account keeps the address it was terminated under, so signing in with another one cannot free that address for a new account. */
  #addressKeptWhileTerminated({ email, emailVerified }: UserInput): Pick<PgUpdateSetSource<ApiPgTables["Users"]>, "email" | "emailVerified"> {
    const isTerminated = sql`${this.table.accountStatus} = 'terminated'`;

    return {
      ...(email !== undefined && { email: sql`CASE WHEN ${isTerminated} THEN ${this.table.email} ELSE ${email} END` }),
      ...(emailVerified !== undefined && { emailVerified: sql`CASE WHEN ${isTerminated} THEN ${this.table.emailVerified} ELSE ${emailVerified} END` })
    };
  }

  async hasVerifiedEmail(email: string): Promise<boolean> {
    const [match] = await this.pg
      .select({ id: this.table.id })
      .from(this.table)
      .where(and(sql`lower(${this.table.email}) = ${email.trim().toLowerCase()}`, eq(this.table.emailVerified, true)))
      .limit(1);

    return !!match;
  }

  async findIdsWithVerifiedEmail(email: string): Promise<{ id: string }[]> {
    return this.pg
      .select({ id: this.table.id })
      .from(this.table)
      .where(and(sql`lower(${this.table.email}) = ${email.trim().toLowerCase()}`, eq(this.table.emailVerified, true)))
      .limit(2);
  }

  async findTrialUsersByFingerprint(fingerprint: string, excludeUserId: string): Promise<{ id: string }[]> {
    return this.pg
      .select({ id: this.table.id })
      .from(this.table)
      .innerJoin(UserWallets, and(eq(UserWallets.userId, this.table.id), eq(UserWallets.isTrialing, true), isNotNull(UserWallets.activatedAt)))
      .where(and(eq(this.table.lastFingerprint, fingerprint), ne(this.table.id, excludeUserId)));
  }

  async findRecentlyActiveByFingerprint(fingerprint: string, excludeUserId: string, withinMinutes: number): Promise<Pick<UserOutput, "id" | "email">[]> {
    return this.pg
      .select({ id: this.table.id, email: this.table.email })
      .from(this.table)
      .where(
        and(
          eq(this.table.lastFingerprint, fingerprint),
          ne(this.table.id, excludeUserId),
          gte(this.table.lastActiveAt, sql`now() - make_interval(mins => ${withinMinutes})`)
        )
      )
      .orderBy(desc(this.table.lastActiveAt))
      .limit(MAX_LINKED_ACCOUNTS);
  }

  /** The triggering account never counts as evidence that its own domain predates the attack, or aging one signup past the window would put that domain permanently out of reach. */
  async hasEstablishedUserWithEmailDomain(domain: string, minAgeDays: number, excludeUserId: string): Promise<boolean> {
    const [match] = await this.pg
      .select({ id: this.table.id })
      .from(this.table)
      .where(
        and(
          sql`lower(${this.table.email}) LIKE ${"%@"} || ${domain}`,
          lt(this.table.createdAt, sql`now() - make_interval(days => ${minAgeDays})`),
          ne(this.table.id, excludeUserId)
        )
      )
      .limit(1);

    return !!match;
  }

  private async findUserWithWallet(whereClause: SQL<unknown>) {
    const result = await this.cursor.query.Users.findFirst({
      where: this.whereAccessibleBy(whereClause),
      with: {
        userWallets: {
          columns: {
            isTrialing: true
          }
        }
      }
    });

    if (!result) return undefined;

    return {
      ...result,
      trial: result.userWallets?.isTrialing ?? true
    };
  }

  toInput(payload: Partial<UserInput>): Partial<UserInput> {
    if (!payload.lastUserAgent) return payload;
    return {
      ...payload,
      lastUserAgent: payload.lastUserAgent.slice(0, userAgentMaxLength)
    };
  }
}
