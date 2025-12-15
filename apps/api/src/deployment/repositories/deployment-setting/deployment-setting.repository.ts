import { and, desc, eq, isNotNull } from "drizzle-orm";
import { singleton } from "tsyringe";

import { UserWallets } from "@src/billing/model-schemas";
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
  isOldWallet: boolean | null;
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

  async *findAutoTopUpDeploymentsByOwnerIteratively(): AsyncGenerator<{ address: string; deploymentSettings: AutoTopUpDeployment[] }> {
    const baseClauses = [eq(this.table.autoTopUpEnabled, true), eq(this.table.closed, false)];

    const distinctOwnersQuery = this.pg
      .selectDistinct({
        address: UserWallets.address
      })
      .from(this.table)
      .leftJoin(Users, eq(this.table.userId, Users.id))
      .leftJoin(UserWallets, eq(Users.id, UserWallets.userId));

    const distinctClauses = [...baseClauses, isNotNull(UserWallets.address)];

    const distinctOwners = await distinctOwnersQuery.where(and(...distinctClauses));

    for (const { address } of distinctOwners) {
      if (!address) {
        continue;
      }

      const deployments = await this.findAutoTopUpDeploymentsByOwner(address);

      if (deployments.length > 0) {
        yield { address, deploymentSettings: deployments as AutoTopUpDeployment[] };
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
        isOldWallet: UserWallets.isOldWallet
      })
      .from(this.table)
      .leftJoin(Users, eq(this.table.userId, Users.id))
      .innerJoin(UserWallets, eq(Users.id, UserWallets.userId))
      .where(and(...clauses))
      .orderBy(desc(this.table.id));

    return deployments as AutoTopUpDeployment[];
  }

  protected toInput(payload: Partial<DeploymentSettingsInput>): Partial<DeploymentSettingsInput> {
    if (!payload.updatedAt) {
      payload.updatedAt = new Date();
    }

    return payload;
  }
}
