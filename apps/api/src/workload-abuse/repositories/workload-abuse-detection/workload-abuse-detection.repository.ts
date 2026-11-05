import { and, desc, eq, gt, inArray, isNull, lt, ne, type SQL, sql } from "drizzle-orm";
import { alias, type PgColumn } from "drizzle-orm/pg-core";
import { singleton } from "tsyringe";

import { UserWallets } from "@src/billing/model-schemas";
import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";
import { Users } from "@src/user/model-schemas";

type Table = ApiPgTables["WorkloadAbuseDetections"];
export type WorkloadAbuseDetectionInput = Partial<Table["$inferInsert"]>;
export type WorkloadAbuseDetectionOutput = Table["$inferSelect"];

const CONFIRMED_VERDICTS: Array<WorkloadAbuseDetectionOutput["verdict"]> = ["hard", "behavioural"];

const CaughtUsers = alias(Users, "caught_user");
const TriggeringUsers = alias(Users, "triggering_user");
const PLUS_TAG_PATTERN = "\\+[^@]*(@[^@]*)$";

/** Auth0 links identities whose addresses agree once lowercased and stripped of a plus tag, so such addresses are one mailbox here too. */
function mailboxOf(email: PgColumn): SQL {
  return sql`regexp_replace(lower(trim(${email})), ${PLUS_TAG_PATTERN}, '\\1')`;
}

@singleton()
export class WorkloadAbuseDetectionRepository extends BaseRepository<Table, WorkloadAbuseDetectionInput, WorkloadAbuseDetectionOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("WorkloadAbuseDetections") protected readonly table: Table,
    protected readonly txManager: TxService
  ) {
    super(pg, table, txManager, "WorkloadAbuseDetection", "WorkloadAbuseDetections");
  }

  accessibleBy(...abilityParams: AbilityParams) {
    return new WorkloadAbuseDetectionRepository(this.pg, this.table, this.txManager).withAbility(...abilityParams) as this;
  }

  async findRecentDetectedTargets({ since }: { since: Date }): Promise<Array<{ walletId: number; dseq: string }>> {
    return await this.cursor
      .selectDistinct({ walletId: this.table.walletId, dseq: this.table.dseq })
      .from(this.table)
      .where(and(inArray(this.table.verdict, CONFIRMED_VERDICTS), gt(this.table.createdAt, since)));
  }

  /** One detection per wallet, since the wipe covers the whole wallet whichever of its detections re-queues it. */
  async findStalledEnforcements({ updatedBefore }: { updatedBefore: Date }): Promise<Array<{ walletId: number; detectionId: string }>> {
    return await this.cursor
      .selectDistinctOn([this.table.walletId], { walletId: this.table.walletId, detectionId: this.table.id })
      .from(this.table)
      .innerJoin(UserWallets, eq(UserWallets.id, this.table.walletId))
      .where(
        and(
          inArray(this.table.verdict, CONFIRMED_VERDICTS),
          inArray(this.table.action, ["enforcing", "enforcement_failed"]),
          lt(this.table.updatedAt, updatedBefore),
          eq(UserWallets.isTrialing, true),
          isNull(UserWallets.abuseLockedAt)
        )
      )
      .orderBy(this.table.walletId, desc(this.table.updatedAt));
  }

  /** A locked wallet settles every confirmed detection it has, including the ones whose own enforcement job never ran or failed. */
  async markWalletEnforced(walletId: number): Promise<void> {
    await this.cursor
      .update(this.table)
      .set({ action: "enforced", enforcementError: null, updatedAt: new Date() })
      .where(and(eq(this.table.walletId, walletId), inArray(this.table.verdict, CONFIRMED_VERDICTS), ne(this.table.action, "enforced")));
  }

  /** Counts only enforced signature matches, the same verdict that queues a domain block, so one mailbox caught again never stands in for a second account. */
  async hasEnforcedSignatureMatchByAnotherMailbox(domain: string, userId: string): Promise<boolean> {
    const [match] = await this.cursor
      .select({ id: this.table.id })
      .from(this.table)
      .innerJoin(CaughtUsers, eq(CaughtUsers.id, this.table.userId))
      .innerJoin(TriggeringUsers, eq(TriggeringUsers.id, userId))
      .where(
        and(
          eq(this.table.verdict, "hard"),
          eq(this.table.action, "enforced"),
          sql`lower(${CaughtUsers.email}) LIKE ${"%@"} || ${domain}`,
          sql`${mailboxOf(CaughtUsers.email)} <> ${mailboxOf(TriggeringUsers.email)}`
        )
      )
      .limit(1);

    return !!match;
  }
}
