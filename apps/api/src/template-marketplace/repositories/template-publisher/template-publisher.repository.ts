import { and, eq, isNull, type SQL } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { TxService } from "@src/core/services";
import type { OrganizationType } from "@src/organization/model-schemas/organization/organization.schema";
import type { TemplatePublisherLink } from "@src/template-marketplace/model-schemas/template-publisher/template-publisher.schema";

type Table = ApiPgTables["TemplatePublishers"];

export type TemplatePublisherOutput = Table["$inferSelect"];

export type PublishingOrganization = { name: string; slug: string; type: OrganizationType; ownerUsername: string | null };

export type TemplatePublisherProfile = {
  organizationId: string;
  name: string;
  type: OrganizationType;
  handle: string;
  bio: string | null;
  links: TemplatePublisherLink[];
  isVerified: boolean;
  isSuspended: boolean;
  /** A personal organization is made long after its owner signed up, so it dates from the owner's account. */
  memberSince: Date;
};

export type TemplatePublisherProfileUpdate = { bio?: string | null; links?: TemplatePublisherLink[] };

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

  async findProfileByHandle(handle: string): Promise<TemplatePublisherProfile | undefined> {
    return await this.#findProfile(eq(this.table.handle, handle));
  }

  async findProfileOfOrganization(organizationId: string): Promise<TemplatePublisherProfile | undefined> {
    return await this.#findProfile(eq(this.table.organizationId, organizationId));
  }

  /** Unscoped, so it must run only after the caller was found to administer this organization. */
  async updateProfile(organizationId: string, update: TemplatePublisherProfileUpdate): Promise<void> {
    await this.#cursor.update(this.table).set(update).where(eq(this.table.organizationId, organizationId));
  }

  async #findProfile(matches: SQL): Promise<TemplatePublisherProfile | undefined> {
    const [found] = await this.#cursor
      .select({
        publisher: this.table,
        name: this.organizations.name,
        type: this.organizations.type,
        organizationCreatedAt: this.organizations.createdAt,
        ownerCreatedAt: this.users.createdAt
      })
      .from(this.table)
      .innerJoin(this.organizations, and(eq(this.organizations.id, this.table.organizationId), isNull(this.organizations.deletedAt)))
      .leftJoin(this.users, eq(this.users.id, this.organizations.createdByUserId))
      .where(matches)
      .limit(1);

    if (!found) return undefined;

    const { publisher, name, type, organizationCreatedAt, ownerCreatedAt } = found;

    return {
      organizationId: publisher.organizationId,
      name,
      type,
      handle: publisher.handle,
      bio: publisher.bio,
      links: publisher.links,
      isVerified: publisher.isVerified,
      isSuspended: publisher.publishingSuspendedAt !== null,
      memberSince: (type === "personal" && ownerCreatedAt) || organizationCreatedAt
    };
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
