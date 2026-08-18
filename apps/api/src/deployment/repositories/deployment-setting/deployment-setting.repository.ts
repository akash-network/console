import { and, desc, eq, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
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

export type AutoTopUpDeployment = {
  id: string;
  walletId: number;
  dseq: string;
  address: string;
  isWalletAutoTopUpEnabled: boolean;
  walletIsTrialing: boolean;
  walletCreatedAt: Date;
  walletActivatedAt: Date | null;
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
        walletActivatedAt: UserWallets.activatedAt
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
   * Atomically claims deployments for auto-funding, returning only the ids this caller won.
   * A deployment is claimable when it has never been funded or its last funding is older than
   * the cooldown. Concurrent callers (hourly cron, immediate job, a retry) racing for the same
   * id resolve to a single winner via the row-lock re-check, so each is funded at most once per
   * cooldown. Ids are sorted so overlapping batches lock rows in the same order.
   */
  async claimForFunding(ids: string[], cooldownMinutes: number): Promise<string[]> {
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
      .returning({ id: this.table.id });

    return claimed.map(row => row.id);
  }

  /** Releases a funding claim so the next pass can retry, used when the deposit did not land. */
  async releaseFundingClaim(ids: string[]): Promise<void> {
    if (!ids.length) {
      return;
    }

    await this.cursor
      .update(this.table)
      .set({ lastFundedAt: null, updatedAt: sql`now()` })
      .where(inArray(this.table.id, ids));
  }

  protected toInput(payload: Partial<DeploymentSettingsInput>): Partial<DeploymentSettingsInput> {
    if (!payload.updatedAt) {
      payload.updatedAt = new Date();
    }

    return payload;
  }
}
