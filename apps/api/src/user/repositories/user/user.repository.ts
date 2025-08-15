import subDays from "date-fns/subDays";
import { and, desc, eq, isNull, lt, lte, SQL, sql } from "drizzle-orm";
import { PgUpdateSetSource } from "drizzle-orm/pg-core";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";
import { userAgentMaxLength } from "@src/user/model-schemas/user/user.schema";

export type UserOutput = ApiPgTables["Users"]["$inferSelect"] & {
  trial?: boolean;
};
export type UserInput = Partial<UserOutput>;

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
    const [item] = await this.cursor.insert(this.table).values(input).returning();
    return this.toOutput(item);
  }

  async findById(id: UserOutput["id"]): Promise<UserOutput | undefined> {
    return this.findUserWithWallet(eq(this.table.id, id));
  }

  async findByUserId(userId: UserOutput["userId"]): Promise<UserOutput | undefined> {
    return this.findUserWithWallet(eq(this.table.userId, userId!));
  }

  async findAnonymousById(id: UserOutput["id"]) {
    return await this.cursor.query.Users.findFirst({ where: this.whereAccessibleBy(and(eq(this.table.id, id), isNull(this.table.userId))) });
  }

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
          lt(this.table.lastActiveAt, sql`now() - make_interval(secs => ${options.throttleTimeSeconds})`)
        )
      );
  }

  async paginateStaleAnonymousUsers(
    { inactivityInDays, limit = 100 }: { inactivityInDays: number; limit?: number },
    cb: (page: UserOutput[]) => Promise<void>
  ) {
    let lastId: string | undefined;

    do {
      const clauses = [isNull(this.table.userId), lte(this.table.lastActiveAt, subDays(new Date(), inactivityInDays))];

      if (lastId) {
        clauses.push(lt(this.table.id, lastId));
      }

      const items = this.toOutputList(await this.cursor.query.Users.findMany({ where: and(...clauses), limit, orderBy: [desc(this.table.id)] }));
      lastId = items.at(-1)?.id;

      if (items.length) {
        await cb(items);
      }
    } while (lastId);
  }

  async upsertByUserId(data: UserInput): Promise<UserOutput> {
    const [item] = await this.cursor
      .insert(this.table)
      .values(this.toInput(data))
      .onConflictDoUpdate({
        target: [this.table.userId],
        set: data
      })
      .returning();
    return this.toOutput(item);
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
