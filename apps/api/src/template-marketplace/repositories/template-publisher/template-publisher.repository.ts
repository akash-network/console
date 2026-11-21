import { eq } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { TxService } from "@src/core/services";
import type { OrganizationType } from "@src/organization/model-schemas/organization/organization.schema";

type Table = ApiPgTables["TemplatePublishers"];

export type TemplatePublisherOutput = Table["$inferSelect"];

export type PublishingOrganization = { name: string; slug: string; type: OrganizationType; ownerUsername: string | null };

@singleton()
export class TemplatePublisherRepository {
  constructor(
    @InjectPg() private readonly pg: ApiPgDatabase,
    @InjectPgTable("TemplatePublishers") private readonly table: Table,
    @InjectPgTable("Organizations") private readonly organizations: ApiPgTables["Organizations"],
    @InjectPgTable("Users") private readonly users: ApiPgTables["Users"],
    private readonly txManager: TxService
  ) {}

  get #cursor() {
    return this.txManager.getPgTx() || this.pg;
  }

  async findByOrganizationId(organizationId: string): Promise<TemplatePublisherOutput | undefined> {
    const [publisher] = await this.#cursor.select().from(this.table).where(eq(this.table.organizationId, organizationId));

    return publisher;
  }

  async findPublishingOrganization(organizationId: string): Promise<PublishingOrganization | undefined> {
    const [organization] = await this.#cursor
      .select({ name: this.organizations.name, slug: this.organizations.slug, type: this.organizations.type, ownerUsername: this.users.username })
      .from(this.organizations)
      .leftJoin(this.users, eq(this.users.id, this.organizations.createdByUserId))
      .where(eq(this.organizations.id, organizationId));

    return organization;
  }

  /** Takes the first handle no other organization holds, without failing the surrounding transaction when one is taken meanwhile. */
  async findOrCreate(organizationId: string, handleCandidates: string[]): Promise<TemplatePublisherOutput> {
    for (const handle of handleCandidates) {
      const [created] = await this.#cursor.insert(this.table).values({ organizationId, handle }).onConflictDoNothing().returning();
      const publisher = created ?? (await this.findByOrganizationId(organizationId));

      if (publisher) return publisher;
    }

    throw new Error(`No free publisher handle for organization ${organizationId}`);
  }
}
