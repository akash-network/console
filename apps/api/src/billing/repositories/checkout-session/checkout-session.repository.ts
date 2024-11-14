import { backOff } from "exponential-backoff";
import { singleton } from "tsyringe";

import { ApiPgDatabase, ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { LoggerService, TxService } from "@src/core/services";

type Table = ApiPgTables["CheckoutSessions"];
export type CheckoutSessionsInput = Partial<Table["$inferInsert"]>;
export type CheckoutSessionsOutput = Table["$inferSelect"];

@singleton()
export class CheckoutSessionRepository extends BaseRepository<Table, CheckoutSessionsInput, CheckoutSessionsOutput> {
  private readonly logger = LoggerService.forContext(CheckoutSessionRepository.name);

  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("CheckoutSessions") protected readonly table: Table,
    protected readonly txManager: TxService
  ) {
    super(pg, table, txManager, "CheckoutSession", "CheckoutSessions");
  }

  accessibleBy(...abilityParams: AbilityParams) {
    return new CheckoutSessionRepository(this.pg, this.table, this.txManager).withAbility(...abilityParams) as this;
  }

  async awaitSessionEnd(sessionId: CheckoutSessionsOutput["sessionId"]) {
    try {
      return await backOff(
        async () => {
          const session = await this.findOneBy({ sessionId });

          if (session) {
            throw new Error("Session is still active");
          }
        },
        { jitter: "full", maxDelay: 5000, numOfAttempts: 20 }
      );
    } catch (error) {
      if (error.message === "Session is still active") {
        this.logger.warn({ event: "SESSION_STILL_ACTIVE", sessionId });
        return;
      }
    }
  }
}
