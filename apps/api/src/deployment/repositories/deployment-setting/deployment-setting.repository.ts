import { and, desc, eq, lt } from "drizzle-orm";
import { last } from "lodash";
import { singleton } from "tsyringe";

import { UserWallets } from "@src/billing/model-schemas";
import { ApiPgDatabase, ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";
import { Users } from "@src/user/model-schemas";

type Table = ApiPgTables["DeploymentSettings"];
export type DeploymentSettingsInput = Partial<Table["$inferInsert"]>;
export type DeploymentSettingsOutput = Table["$inferSelect"];

export type AutoTopUpDeployment = {
  id: number;
  walletId: number;
  dseq: string;
  address: string;
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

  async paginateAutoTopUpDeployments(options: { limit: number }, cb: (page: AutoTopUpDeployment[]) => Promise<void>) {
    let lastId: number | undefined;

    do {
      const clauses = [eq(this.table.autoTopUpEnabled, true)];

      if (lastId) {
        clauses.push(lt(this.table.id, lastId));
      }

      const items = await this.pg
        .select({
          id: this.table.id,
          walletId: UserWallets.id,
          dseq: this.table.dseq,
          address: UserWallets.address
        })
        .from(this.table)
        .leftJoin(Users, eq(this.table.userId, Users.id))
        .leftJoin(UserWallets, eq(Users.id, UserWallets.userId))
        .where(and(...clauses))
        .limit(options.limit)
        .orderBy(desc(this.table.id), desc(UserWallets.address));

      lastId = last(items)?.id;

      if (items.length) {
        await cb(items);
      }
    } while (lastId);
  }
}
