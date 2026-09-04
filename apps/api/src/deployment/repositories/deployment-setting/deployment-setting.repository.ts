import { and, asc, desc, eq, gt, gte, inArray, isNotNull, isNull, lt, lte, or, sql } from "drizzle-orm";
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

export type ExpiredRuntimeDeployment = {
  id: string;
  userId: string;
  dseq: string;
  runtimeEndsAt: Date;
};

export type ExpiringRuntimeDeployment = {
  id: string;
  dseq: string;
  walletId: number;
  address: string;
  userId: string;
  runtimeLimitHours: number;
  runtimeEndsAt: Date;
  /** The deadline as stored, in text, so a claim can match it without losing the sub-millisecond digits a `Date` drops. */
  runtimeEndsAtMarker: string;
};

export type OpenDeployment = {
  id: string;
  dseq: string;
  address: string;
};

export type AutoTopUpDeployment = {
  id: string;
  userId: string;
  walletId: number;
  dseq: string;
  address: string;
  isWalletAutoTopUpEnabled: boolean;
  walletIsTrialing: boolean;
  walletCreatedAt: Date;
  walletActivatedAt: Date | null;
  walletCreditsLowNotifiedAt: Date | null;
  runtimeLimitHours: number | null;
  runtimeEndsAt: Date | null;
  lastFundedAt: Date | null;
};

/**
 * A deployment funds itself unless its owner turns that off: creating one already requires an
 * initialised managed wallet, so there is no owner for whom auto top-up cannot work.
 */
const AUTO_TOP_UP_ENABLED_BY_DEFAULT = true;

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

  /**
   * Applies the auto top-up default here rather than as a column default, so every row is written by
   * code that can be read and tested. The column is NOT NULL with no database default on purpose: it
   * makes `autoTopUpEnabled` required on a direct `insert(DeploymentSettings)`, so a write that skips
   * this method has to state its own value instead of silently inheriting one nobody chose.
   */
  override create(input: DeploymentSettingsInput): Promise<DeploymentSettingsOutput> {
    return super.create({ ...input, autoTopUpEnabled: input.autoTopUpEnabled ?? AUTO_TOP_UP_ENABLED_BY_DEFAULT });
  }

  /** Reads every owner in one query, because the per-owner lookup this used to repeat selects from the same tables under the same filters. */
  async *findAutoTopUpDeploymentsByOwnerIteratively(): AsyncGenerator<{
    address: string;
    walletId: number;
    deploymentSettings: AutoTopUpDeployment[];
  }> {
    const deploymentsByOwner = new Map<string, AutoTopUpDeployment[]>();

    for (const deployment of await this.#findAutoTopUpDeployments()) {
      deploymentsByOwner.set(deployment.address, [...(deploymentsByOwner.get(deployment.address) ?? []), deployment]);
    }

    for (const [address, deploymentSettings] of deploymentsByOwner) {
      yield { address, walletId: deploymentSettings[0].walletId, deploymentSettings };
    }
  }

  findAutoTopUpDeploymentsByOwner(address: string): Promise<AutoTopUpDeployment[]> {
    return this.#findAutoTopUpDeployments(address);
  }

  /** Keyset-paged on `id`, the leading column of `id_auto_top_up_enabled_closed_idx`, so each batch stays an index scan. */
  async *findOpenDeploymentsIteratively({ batchSize }: { batchSize: number }): AsyncGenerator<OpenDeployment[]> {
    let cursor: string | undefined;

    while (true) {
      const batch = await this.pg
        .select({
          id: this.table.id,
          dseq: this.table.dseq,
          address: UserWallets.address
        })
        .from(this.table)
        .innerJoin(Users, eq(this.table.userId, Users.id))
        .innerJoin(UserWallets, eq(Users.id, UserWallets.userId))
        .where(and(eq(this.table.closed, false), isNotNull(UserWallets.address), ...(cursor ? [gt(this.table.id, cursor)] : [])))
        .orderBy(asc(this.table.id))
        .limit(batchSize);

      if (!batch.length) {
        return;
      }

      yield batch as OpenDeployment[];

      if (batch.length < batchSize) {
        return;
      }

      cursor = batch[batch.length - 1].id;
    }
  }

  async #findAutoTopUpDeployments(address?: string): Promise<AutoTopUpDeployment[]> {
    const clauses = [eq(this.table.autoTopUpEnabled, true), eq(this.table.closed, false), isNotNull(UserWallets.address)];

    if (address !== undefined) {
      clauses.push(eq(UserWallets.address, address));
    }

    const deployments = await this.pg
      .select({
        id: this.table.id,
        userId: this.table.userId,
        dseq: this.table.dseq,
        walletId: UserWallets.id,
        address: UserWallets.address,
        isWalletAutoTopUpEnabled: sql<boolean>`coalesce(${WalletSetting.autoReloadEnabled} and ${WalletSetting.autoReloadPausedAt} is null, false)`,
        walletIsTrialing: sql<boolean>`coalesce(${UserWallets.isTrialing}, true)`,
        walletCreatedAt: UserWallets.createdAt,
        walletActivatedAt: UserWallets.activatedAt,
        walletCreditsLowNotifiedAt: UserWallets.creditsLowNotifiedAt,
        runtimeLimitHours: this.table.runtimeLimitHours,
        runtimeEndsAt: this.table.runtimeEndsAt,
        lastFundedAt: this.table.lastFundedAt
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
   * Deployments whose runtime limit has run out and that have not been marked closed yet. Deliberately
   * ignores `autoTopUpEnabled`: a user who turned funding off after setting a limit still asked for the
   * deployment to end at the deadline, and closing it is what honours that.
   *
   * Feeds the hourly reconcile that backstops the per-deployment close jobs, so it selects only what a
   * job payload needs. The owner wallet is resolved when the job runs rather than joined here, which
   * also keeps a row whose wallet is missing visible instead of silently dropping it from the sweep.
   */
  async findExpiredRuntimeDeployments(): Promise<ExpiredRuntimeDeployment[]> {
    const deployments = await this.pg
      .select({
        id: this.table.id,
        userId: this.table.userId,
        dseq: this.table.dseq,
        runtimeEndsAt: this.table.runtimeEndsAt
      })
      .from(this.table)
      .where(and(eq(this.table.closed, false), isNotNull(this.table.runtimeEndsAt), lt(this.table.runtimeEndsAt, sql`now()`)))
      .orderBy(desc(this.table.id));

    return deployments as ExpiredRuntimeDeployment[];
  }

  /**
   * Deployments approaching their runtime limit that have not been warned about this deadline yet.
   *
   * `minLimitHours` keeps short-lived deployments out: a user who asked for two hours does not need an
   * email about a deadline they set minutes earlier and can barely act on. Rows already past their
   * deadline are left to `findExpiredRuntimeDeployments`, and trial wallets are excluded because a trial
   * deployment already gets its own `beforeCloseTrialDeployment` warning.
   *
   * Eligibility is keyed on the deadline itself rather than a plain "already notified" flag, so raising
   * a limit re-arms the warning for the new deadline with no extra bookkeeping in `applyRuntimeLimit`,
   * and dropping a limit takes the row out of the sweep by nulling `runtimeEndsAt`.
   */
  async findExpiringRuntimeDeployments({ leadHours, minLimitHours }: { leadHours: number; minLimitHours: number }): Promise<ExpiringRuntimeDeployment[]> {
    const deployments = await this.pg
      .select({
        id: this.table.id,
        dseq: this.table.dseq,
        userId: this.table.userId,
        walletId: UserWallets.id,
        address: UserWallets.address,
        runtimeLimitHours: this.table.runtimeLimitHours,
        runtimeEndsAt: this.table.runtimeEndsAt,
        runtimeEndsAtMarker: sql<string>`${this.table.runtimeEndsAt}::text`
      })
      .from(this.table)
      .leftJoin(Users, eq(this.table.userId, Users.id))
      .innerJoin(UserWallets, eq(Users.id, UserWallets.userId))
      .where(
        and(
          eq(this.table.closed, false),
          eq(UserWallets.isTrialing, false),
          gte(this.table.runtimeLimitHours, minLimitHours),
          isNotNull(this.table.runtimeEndsAt),
          gt(this.table.runtimeEndsAt, sql`now()`),
          lte(this.table.runtimeEndsAt, sql`now() + (${leadHours} * interval '1 hour')`),
          sql`${this.table.runtimeEndingNotifiedFor} is distinct from ${this.table.runtimeEndsAt}`
        )
      )
      .orderBy(desc(this.table.id));

    return deployments as ExpiringRuntimeDeployment[];
  }

  /**
   * Claims the right to warn about one deployment's deadline, returning false when another pass already
   * has it. Matching on the deadline keeps the claim tied to the one it was taken for, so an extension
   * landing mid-sweep cannot be marked as warned by a pass that read the old deadline.
   *
   * The marker is matched as text, like `releaseFundingClaim` does: deadlines anchored from `now()` carry
   * microseconds, and a `Date` drops them, so comparing the round-tripped value would reject every
   * deadline the countdown itself set.
   *
   * Callers claim before sending rather than stamping after. The sweep runs far more often than the
   * warning window is wide, so a send that succeeded but failed to stamp would repeat the same email on
   * every pass until the deadline. A send that fails gives the claim back through
   * `releaseRuntimeEndingClaim`, so the warning is retried rather than lost.
   */
  async claimRuntimeEndingNotification(id: string, runtimeEndsAtMarker: string): Promise<boolean> {
    const [claimed] = await this.cursor
      .update(this.table)
      .set({ runtimeEndingNotifiedFor: sql`${this.table.runtimeEndsAt}`, updatedAt: sql`now()` })
      .where(
        and(
          eq(this.table.id, id),
          eq(this.table.runtimeEndsAt, sql`${runtimeEndsAtMarker}::timestamptz`),
          sql`${this.table.runtimeEndingNotifiedFor} is distinct from ${this.table.runtimeEndsAt}`
        )
      )
      .returning({ id: this.table.id });

    return !!claimed;
  }

  /**
   * Gives back a claim whose notification was never accepted, so the next sweep can warn about the same
   * deadline. Scoped to the exact deadline the claim was taken against, so a release arriving after an
   * extension cannot clear the stamp a later pass wrote for the new deadline.
   */
  async releaseRuntimeEndingClaim(id: string, runtimeEndsAtMarker: string): Promise<void> {
    await this.cursor
      .update(this.table)
      .set({ runtimeEndingNotifiedFor: null, updatedAt: sql`now()` })
      .where(
        and(
          eq(this.table.id, id),
          eq(this.table.runtimeEndsAt, sql`${runtimeEndsAtMarker}::timestamptz`),
          eq(this.table.runtimeEndingNotifiedFor, sql`${runtimeEndsAtMarker}::timestamptz`)
        )
      );
  }

  /**
   * Records what a deployment is, at the moment it is created and again every time it is updated: the
   * SDL it was given, stripped of its secrets and small enough to keep, the manifest version it commits
   * on chain, and the runtime limit its creator chose. One statement, so a deployment can never end up
   * remembering half of itself, and so the sealed secrets a later phase adds land in the same write as
   * the SDL they belong to.
   *
   * Upserts on the (dseq, userId) unique because a settings read creates a row lazily, because the
   * caller retries a create that failed to broadcast, and because an update of a deployment that
   * predates any record has to produce the row a create would have. The conflict branch leaves every
   * field it does not name as the earlier writer set them, and an absent runtime limit counts as
   * unnamed: drizzle drops undefined out of the set clause, so neither creating nor updating without a
   * limit can clear one already there.
   *
   * `sealedSecrets` reads that same rule in both directions, which is why it is typed to allow null.
   * A create always states a value — the token, or null when the request carried no secrets — so a
   * retry replaces whatever a failed attempt left behind rather than inheriting it. An update states
   * nothing, so a token it was never given survives it.
   */
  async upsertDefinition({
    userId,
    dseq,
    sdl,
    manifestVersion,
    runtimeLimitHours,
    sealedSecrets
  }: {
    userId: string;
    dseq: string;
    sdl: string;
    manifestVersion: string;
    runtimeLimitHours?: number;
    sealedSecrets?: string | null;
  }): Promise<string> {
    const [row] = await this.cursor
      .insert(this.table)
      .values({ userId, dseq, autoTopUpEnabled: AUTO_TOP_UP_ENABLED_BY_DEFAULT, sdl, manifestVersion, runtimeLimitHours, sealedSecrets })
      .onConflictDoUpdate({
        target: [this.table.dseq, this.table.userId],
        set: { sdl, manifestVersion, runtimeLimitHours, sealedSecrets, updatedAt: sql`now()` }
      })
      .returning({ id: this.table.id });

    return row.id;
  }

  /** Conflicts are ignored rather than merged, so a row another path already wrote keeps every choice its writer made. */
  async createDefaultIfMissing({ userId, dseq }: { userId: string; dseq: string }): Promise<boolean> {
    const rows = await this.cursor
      .insert(this.table)
      .values({ userId, dseq, autoTopUpEnabled: AUTO_TOP_UP_ENABLED_BY_DEFAULT })
      .onConflictDoNothing({ target: [this.table.dseq, this.table.userId] })
      .returning({ id: this.table.id });

    return rows.length > 0;
  }

  /**
   * Raises a deployment's runtime limit and shifts an anchored deadline by the same delta in one
   * guarded UPDATE. The WHERE clause re-checks every rule the service validated, plus the caller's
   * ability predicate, so two extensions racing each other cannot compound past one increment and a
   * row the caller cannot update stays untouched; and because callers pass an absolute total rather
   * than a delta, a retried request is a no-op instead of a second extension. Returns undefined when
   * the row no longer satisfies the rules.
   *
   * `greatest(runtime_ends_at, now())` extends from the present when the deadline has already passed,
   * so an extension always buys the full increment. A null deadline stays null: anchoring belongs to
   * lease start. A limit set through the API on a deployment whose lease is already running therefore
   * stays unanchored until the draining sweep's late-anchor fallback picks it up within the hour. The
   * web UI never hits that path, since it sets the limit before any lease exists.
   *
   * Turns auto top-up on with the limit, because funding is what keeps the deployment alive up to the
   * deadline. A limited row with funding off is never anchored and never funded, so its limit would
   * report a runtime the deployment never gets.
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
        autoTopUpEnabled: true,
        runtimeEndsAt: sql`case
          when ${this.table.runtimeEndsAt} is null then null
          else greatest(${this.table.runtimeEndsAt}, now()) + ((${runtimeLimitHours} - ${this.table.runtimeLimitHours}) * interval '1 hour')
        end`,
        updatedAt: sql`now()`
      })
      .where(
        this.whereAccessibleBy(
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

  async markAsClosed(ids: string[]): Promise<void> {
    if (!ids.length) {
      return;
    }

    await this.updateManyById(ids, { closed: true });
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

  /** Claimed before the email goes out, not stamped after, because the sweep runs many times an hour while an outage lasts days. */
  async claimProviderUnreachableNotification({ userId, dseq, downSinceMarker }: { userId: string; dseq: string; downSinceMarker: string }): Promise<boolean> {
    const [claimed] = await this.cursor
      .insert(this.table)
      .values({
        userId,
        dseq,
        autoTopUpEnabled: false,
        providerUnreachableNotifiedFor: sql`${downSinceMarker}::timestamptz`
      })
      .onConflictDoUpdate({
        target: [this.table.dseq, this.table.userId],
        set: { providerUnreachableNotifiedFor: sql`${downSinceMarker}::timestamptz`, updatedAt: sql`now()` },
        setWhere: sql`${this.table.providerUnreachableNotifiedFor} is distinct from ${downSinceMarker}::timestamptz`
      })
      .returning({ id: this.table.id });

    return !!claimed;
  }

  /** Scoped to the exact outage the claim was taken against, so a late release cannot clear the stamp a later pass wrote for a newer outage. */
  async releaseProviderUnreachableClaim({ userId, dseq, downSinceMarker }: { userId: string; dseq: string; downSinceMarker: string }): Promise<void> {
    await this.cursor
      .update(this.table)
      .set({ providerUnreachableNotifiedFor: null, updatedAt: sql`now()` })
      .where(
        and(eq(this.table.userId, userId), eq(this.table.dseq, dseq), eq(this.table.providerUnreachableNotifiedFor, sql`${downSinceMarker}::timestamptz`))
      );
  }

  /**
   * Records that a deployment is closed, creating the row when the deployment has none — a deployment
   * created before settings existed, or outside the web app, still has to be remembered as closed or
   * every later sweep would try to close it again. Such a row is written with funding off, since a
   * closed deployment has nothing to fund.
   */
  async markClosed({ userId, dseq }: { userId: string; dseq: string }): Promise<void> {
    await this.cursor
      .insert(this.table)
      .values({ userId, dseq, autoTopUpEnabled: false, closed: true })
      .onConflictDoUpdate({
        target: [this.table.dseq, this.table.userId],
        set: { closed: true, updatedAt: sql`now()` }
      });
  }

  protected toInput(payload: Partial<DeploymentSettingsInput>): Partial<DeploymentSettingsInput> {
    if (!payload.updatedAt) {
      payload.updatedAt = new Date();
    }

    return payload;
  }
}
