import { singleton } from "tsyringe";

import { ApiPgDatabase, ApiPgTables, InjectPg, InjectPgTable } from "@src/core";

@singleton()
export class DbTestingService {
  constructor(
    @InjectPg() private readonly pg: ApiPgDatabase,
    @InjectPgTable("Users") private readonly users: ApiPgTables["Users"],
    @InjectPgTable("UserWallets") private readonly userWallets: ApiPgTables["UserWallets"],
    @InjectPgTable("CheckoutSessions") private readonly checkoutSessions: ApiPgTables["CheckoutSessions"]
  ) {}

  async cleanAll() {
    await this.pg.delete(this.checkoutSessions);
    await this.pg.delete(this.userWallets);
    await this.pg.delete(this.users);
  }
}
