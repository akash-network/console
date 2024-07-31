import { AnyAbility } from "@casl/ability";
import { PgTableWithColumns } from "drizzle-orm/pg-core/table";
import { SQL } from "drizzle-orm/sql/sql";

import { ApiPgDatabase, InjectPg, TxService } from "@src/core";
import { DrizzleAbility } from "@src/lib/drizzle-ability/drizzle-ability";
import { InjectUserSchema } from "@src/user/providers";

export type AbilityParams = [AnyAbility, Parameters<AnyAbility["can"]>[0]];

export abstract class BaseRepository<T extends PgTableWithColumns<any>> {
  protected ability?: DrizzleAbility<T>;

  get cursor() {
    return this.txManager.getPgTx() || this.pg;
  }

  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectUserSchema() protected readonly schema: T,
    protected readonly txManager: TxService,
    protected readonly entityName: string
  ) {}

  protected withAbility(ability: AnyAbility, action: Parameters<AnyAbility["can"]>[0]) {
    this.ability = new DrizzleAbility(this.schema, ability, action, this.entityName);
    return this;
  }

  protected whereAccessibleBy(where: SQL) {
    return this.ability?.whereAccessibleBy(where) || where;
  }

  abstract accessibleBy(...abilityParams: AbilityParams): this;
}
