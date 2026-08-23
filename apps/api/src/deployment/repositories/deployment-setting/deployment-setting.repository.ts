import { and, desc, eq, gte, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { singleton } from "tsyringe";

import { UserWallets, WalletSetting } from "@src/billing/model-schemas";
import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";
import { Users } from "@src/user/model-schemas";

type Table = ApiPgTables["DeploymentSettings"];
export type DeploymentSettingsInput = Partial<Table["$inferInsert"]>;
export type DeploymentSettingsDbOutput = Table["$inferSelect"];
export type DeploymentSettingsOutput = Omit<DeploymentSettingsDbOutput, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

/** A won auto-funding claim: the deployment setting id and the exact marker the claim wrote. */
export type FundingClaim = {
  id: string;
  claimedAt: string;
};

export type AutoTopUpDeployment = {
  id: string;
  walletId: number;
  dseq: string;
  address: string;
  isWalletAutoTopUpEnabled: boolean;
  walletIsTrialing: boolean;
  walletCreatedAt: Date;
  walletActivatedAt: Date | null;
  runtimeLimitHours: number | null;
  runtimeEndsAt: Date | null;
};

@singleton()
export class DeploymentSettingRepository extends BaseRepository<Table, DeploymentSettingsInput, DeploymentSettingsOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("DeploymentSettings") protected readonly table: Table,
    protected readonly txManager: TxService
  ) {
    super(pg, table, txManager, "DeploymentSetting", "DeploymentSettings");
  }

  accessibleBy(...abilityParams: AbilityParams) {
    return new DeploymentSettingRepository(this.pg, this.table, this.txManager).withAbility(...abilityParams) as this;
  }

  async *findAutoTopUpDeploymentsByOwnerIteratively(): AsyncGenerator<{
    address: string;
    walletId: number;
    deploymentSettings: AutoTopUpDeployment[];
  }> {
    const baseClauses = [eq(this.table.autoTopUpEnabled, true), eq(this.table.closed, false)];

    const distinctOwnersQuery = this.pg
      .selectDistinctOn([UserWallets.address], {
        walletId: UserWallets.id,
        address: UserWallets.address
      })
      .from(this.table)
      .leftJoin(Users, eq(this.table.userId, Users.id))
      .leftJoin(UserWallets, eq(Users.id, UserWallets.userId));

    const distinctClauses = [...baseClauses, isNotNull(UserWallets.address)];

    const distinctOwners = await distinctOwnersQuery.where(and(...distinctClauses));

    for (const { address, walletId } of distinctOwners) {
      if (!address || !walletId) {
        continue;
      }

      const deployments = await this.findAutoTopUpDeploymentsByOwner(address);

      if (deployments.length > 0) {
        yield { address, walletId, deploymentSettings: deployments as AutoTopUpDeployment[] };
      }
    }
  }

  async findAutoTopUpDeploymentsByOwner(address: string): Promise<AutoTopUpDeployment[]> {
    const clauses = [eq(this.table.autoTopUpEnabled, true), eq(this.table.closed, false), eq(UserWallets.address, address)];

    const deployments = await this.pg
      .select({
        id: this.table.id,
        dseq: this.table.dseq,
        walletId: UserWallets.id,
        address: UserWallets.address,
        isWalletAutoTopUpEnabled: sql<boolean>`coalesce(${WalletSetting.autoReloadEnabled}, false)`,
        walletIsTrialing: sql<boolean>`coalesce(${UserWallets.isTrialing}, true)`,
        walletCreatedAt: UserWallets.createdAt,
        walletActivatedAt: UserWallets.activatedAt,
        runtimeLimitHours: this.table.runtimeLimitHours,
        runtimeEndsAt: this.table.runtimeEndsAt
      })
      .from(this.table)
      .leftJoin(Users, eq(this.table.userId, Users.id))
      .innerJoin(UserWallets, eq(Users.id, UserWallets.userId))
      .leftJoin(WalletSetting, eq(UserWallets.id, WalletSetting.walletId))
      .where(and(...clauses))
      .orderBy(desc(this.table.id));

    return deployments as AutoTopUpDeployment[];
  }

  /**
   * Persists a runtime limit chosen at deployment creation. Upserts on the (dseq, userId) unique so a
   * concurrent lazy row creation from a settings read cannot drop the limit; the conflict branch only
   * writes the limit and leaves the row's other fields as the earlier writer set them.
   */
  async upsertRuntimeLimit({ userId, dseq, runtimeLimitHours }: { userId: string; dseq: string; runtimeLimitHours: number }): Promise<void> {
    await this.cursor
      .insert(this.table)
      .values({ userId, dseq, autoTopUpEnabled: true, runtimeLimitHours })
      .onConflictDoUpdate({
        target: [this.table.dseq, this.table.userId],
        set: { runtimeLimitHours, updatedAt: sql`now()` }
      });
  }

  /**
   * Raises a deployment's runtime limit and shifts an anchored deadline by the same delta in one
   * guarded UPDATE. The WHERE clause re-checks every rule the service validated, so two extensions
   * racing each other cannot compound past one increment; and because callers pass an absolute total
   * rather than a delta, a retried request is a no-op instead of a second extension. Returns
   * undefined when the row no longer satisfies the rules.
   *
   * `greatest(runtime_ends_at, now())` extends from the present when the deadline has already passed,
   * so an extension always buys the full increment. A null deadline stays null: anchoring belongs to
   * lease start. A limit set through the API on a deployment whose lease is already running therefore
   * stays unanchored until the draining sweep's late-anchor fallback picks it up within the hour. The
   * web UI never hits that path, since it sets the limit before any lease exists.
   */
  async applyRuntimeLimit({
    userId,
    dseq,
    runtimeLimitHours,
    maxIncrementHours
  }: {
    userId: string;
    dseq: string;
    runtimeLimitHours: number;
    maxIncrementHours: number;
  }): Promise<DeploymentSettingsOutput | undefined> {
    const [row] = await this.cursor
      .update(this.table)
      .set({
        runtimeLimitHours,
        runtimeEndsAt: sql`case
          when ${this.table.runtimeEndsAt} is null then null
          else greatest(${this.table.runtimeEndsAt}, now()) + ((${runtimeLimitHours} - ${this.table.runtimeLimitHours}) * interval '1 hour')
        end`,
        updatedAt: sql`now()`
      })
      .where(
        and(
          eq(this.table.userId, userId),
          eq(this.table.dseq, dseq),
          eq(this.table.closed, false),
          or(
            isNull(this.table.runtimeLimitHours),
            and(lt(this.table.runtimeLimitHours, runtimeLimitHours), gte(this.table.runtimeLimitHours, runtimeLimitHours - maxIncrementHours))
          )
        )
      )
      .returning();

    return row ? this.toOutput(row) : undefined;
  }

  /**
   * Anchors a runtime-limited deployment's absolute deadline at now + its limit, keeping an already
   * anchored deadline via coalesce so concurrent funding passes and job retries agree on one clock.
   * Returns the row's deadline, or null when the deployment has no runtime limit.
   */
  async startRuntimeCountdown(id: string): Promise<Date | null> {
    const [row] = await this.cursor
      .update(this.table)
      .set({
        runtimeEndsAt: sql`coalesce(${this.table.runtimeEndsAt}, now() + (${this.table.runtimeLimitHours} * interval '1 hour'))`,
        updatedAt: sql`now()`
      })
      .where(and(eq(this.table.id, id), isNotNull(this.table.runtimeLimitHours)))
      .returning({ runtimeEndsAt: this.table.runtimeEndsAt });

    return row?.runtimeEndsAt ?? null;
  }

  /**
   * Atomically claims deployments for auto-funding, returning only the claims this caller won.
   * A deployment is claimable when it has never been funded or its last funding is older than
   * the cooldown. Concurrent callers (hourly cron, immediate job, a retry) racing for the same
   * id resolve to a single winner via the row-lock re-check, so each is funded at most once per
   * cooldown. Ids are sorted so overlapping batches lock rows in the same order. The claim marker
   * comes back as text to keep full microsecond precision, which `releaseFundingClaim` matches on.
   */
  async claimForFunding(ids: string[], cooldownMinutes: number): Promise<FundingClaim[]> {
    if (!ids.length) {
      return [];
    }

    const orderedIds = [...ids].sort();

    const claimed = await this.cursor
      .update(this.table)
      .set({ lastFundedAt: sql`now()`, updatedAt: sql`now()` })
      .where(
        and(
          inArray(this.table.id, orderedIds),
          or(isNull(this.table.lastFundedAt), lt(this.table.lastFundedAt, sql`now() - (${cooldownMinutes} * interval '1 minute')`))
        )
      )
      .returning({ id: this.table.id, claimedAt: sql<string>`${this.table.lastFundedAt}::text` });

    return claimed;
  }

  /**
   * Releases a funding claim so the next pass can retry, used when the deposit did not land. Each
   * release is scoped to the exact marker its claim wrote, so a caller whose claim already aged out
   * of the cooldown and was re-taken by another pass cannot clear that newer claim.
   */
  async releaseFundingClaim(claims: FundingClaim[]): Promise<void> {
    if (!claims.length) {
      return;
    }

    await this.cursor
      .update(this.table)
      .set({ lastFundedAt: null, updatedAt: sql`now()` })
      .where(or(...claims.map(claim => and(eq(this.table.id, claim.id), eq(this.table.lastFundedAt, sql`${claim.claimedAt}::timestamp`)))));
  }

  protected toInput(payload: Partial<DeploymentSettingsInput>): Partial<DeploymentSettingsInput> {
    if (!payload.updatedAt) {
      payload.updatedAt = new Date();
    }

    return payload;
  }
}
