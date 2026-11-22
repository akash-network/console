import { and, arrayOverlaps, desc, eq, ne, notExists, sql } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";
import { BlockedEmailDomains } from "@src/workload-abuse/model-schemas";

type Table = ApiPgTables["EmailDomainMailHosts"];
export type EmailDomainMailHostInput = Partial<Table["$inferInsert"]>;
export type EmailDomainMailHostOutput = Table["$inferSelect"];
export type EmailDomainMailProfile = Pick<EmailDomainMailHostOutput, "domain" | "mxHosts" | "selfHostedMxIps" | "hasWebsite">;

@singleton()
export class EmailDomainMailHostRepository extends BaseRepository<Table, EmailDomainMailHostInput, EmailDomainMailHostOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("EmailDomainMailHosts") protected readonly table: Table,
    protected readonly txManager: TxService
  ) {
    super(pg, table, txManager, "EmailDomainMailHost", "EmailDomainMailHosts");
  }

  accessibleBy(...abilityParams: AbilityParams) {
    return new EmailDomainMailHostRepository(this.pg, this.table, this.txManager).withAbility(...abilityParams) as this;
  }

  async upsertProfile({ domain, mxHosts, selfHostedMxIps, hasWebsite }: EmailDomainMailProfile): Promise<void> {
    await this.cursor
      .insert(this.table)
      .values({ domain, mxHosts, selfHostedMxIps, hasWebsite })
      .onConflictDoUpdate({ target: this.table.domain, set: { mxHosts, selfHostedMxIps, hasWebsite, updatedAt: sql`now()` } });
  }

  /** Newest blocks first, since a fresh block is the one whose farm is still signing up siblings. */
  async findBlockedDomainsWithoutProfile(limit: number): Promise<string[]> {
    const profile = this.cursor.select({ domain: this.table.domain }).from(this.table).where(eq(this.table.domain, BlockedEmailDomains.domain));

    const rows = await this.cursor
      .select({ domain: BlockedEmailDomains.domain })
      .from(BlockedEmailDomains)
      .where(and(eq(BlockedEmailDomains.status, "blocked"), notExists(profile)))
      .orderBy(desc(BlockedEmailDomains.createdAt))
      .limit(limit);

    return rows.map(row => row.domain);
  }

  /** Reads the same nearest-rule order as the blocklist itself, so an operator's allow on a subdomain keeps it from linking anything. */
  async findBlockedDomainSharingMxIps(mxIps: string[], excludeDomain: string): Promise<string | undefined> {
    if (!mxIps.length) return undefined;

    const nearestRuleStatus = sql`(
      SELECT ${BlockedEmailDomains.status} FROM ${BlockedEmailDomains}
      WHERE ${this.table.domain} = ${BlockedEmailDomains.domain} OR ${this.table.domain} LIKE '%.' || ${BlockedEmailDomains.domain}
      ORDER BY length(${BlockedEmailDomains.domain}) DESC
      LIMIT 1
    )`;

    const [match] = await this.cursor
      .select({ domain: this.table.domain })
      .from(this.table)
      .where(and(arrayOverlaps(this.table.selfHostedMxIps, mxIps), ne(this.table.domain, excludeDomain), sql`${nearestRuleStatus} = 'blocked'`))
      .limit(1);

    return match?.domain;
  }
}
