import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { TxService } from "@src/core/services";
import type { ImportedTemplateState } from "@src/template-marketplace/lib/imported-template/imported-template";
import type { PublishingOrganization } from "@src/template-marketplace/repositories/template-publisher/template-publisher.repository";
import type { TemplateModerationStatus } from "@src/user/model-schemas/template/template.schema";

type Table = ApiPgTables["Templates"];
type Row = Table["$inferSelect"];

export type StoredImportedTemplate = ImportedTemplateState & { id: string; importedRef: string; moderationStatus: TemplateModerationStatus };

export type NewImportedTemplate = Pick<
  Row,
  "organizationId" | "importedRef" | "importedContentHash" | "title" | "summary" | "icon" | "categories" | "sdl" | "description" | "cpu" | "ram" | "storage"
>;

export type ImportedTemplateUpdate = Partial<
  Pick<Row, "title" | "summary" | "categories" | "isListed" | "importedContentHash" | "sdl" | "description" | "cpu" | "ram" | "storage">
>;

const UNLISTED_TEMPLATES_PER_STATEMENT = 500;

/** Written by the import job alone, across organizations and with no caller, so it carries no ability rules. */
@singleton()
export class ImportedTemplateRepository {
  constructor(
    @InjectPg() private readonly pg: ApiPgDatabase,
    @InjectPgTable("Templates") private readonly table: Table,
    @InjectPgTable("Organizations") private readonly organizations: ApiPgTables["Organizations"],
    @InjectPgTable("Users") private readonly users: ApiPgTables["Users"],
    @InjectPgTable("TemplateModerationEvents") private readonly moderationEvents: ApiPgTables["TemplateModerationEvents"],
    private readonly txManager: TxService
  ) {}

  get #cursor() {
    return this.txManager.getPgTx() || this.pg;
  }

  async findOwningOrganization(organizationId: string): Promise<PublishingOrganization | undefined> {
    const [organization] = await this.#cursor
      .select({ name: this.organizations.name, slug: this.organizations.slug, type: this.organizations.type, ownerUsername: this.users.username })
      .from(this.organizations)
      .leftJoin(this.users, eq(this.users.id, this.organizations.createdByUserId))
      .where(and(eq(this.organizations.id, organizationId), isNull(this.organizations.deletedAt)));

    return organization;
  }

  async listAll(): Promise<StoredImportedTemplate[]> {
    const rows = await this.#cursor.select(this.#storedColumns).from(this.table).where(isNotNull(this.table.importedRef));

    return rows.map(row => ({ ...row, importedRef: row.importedRef! }));
  }

  /** Answers nothing when another run already holds the gallery id, which the unique index gives to one row only. */
  async create(template: NewImportedTemplate): Promise<string | undefined> {
    const [created] = await this.#cursor
      .insert(this.table)
      .values({ ...template, visibility: "public", isPublic: true, isListed: true, isOfficial: true, publishedAt: sql`now()` })
      .onConflictDoNothing({ target: this.table.importedRef })
      .returning({ id: this.table.id });

    return created?.id;
  }

  /** Must run in the transaction that writes the template, which then reads the row another run or staff may have changed since it was listed. */
  async findAndLock(id: string): Promise<StoredImportedTemplate | undefined> {
    const [row] = await this.#cursor
      .select(this.#storedColumns)
      .from(this.table)
      .where(and(eq(this.table.id, id), isNotNull(this.table.importedRef)))
      .for("no key update", { of: this.table });

    return row && { ...row, importedRef: row.importedRef! };
  }

  async update(id: string, update: ImportedTemplateUpdate): Promise<void> {
    await this.#cursor.update(this.table).set(update).where(eq(this.table.id, id));
  }

  /** Leaves a template staff hid or removed as it is, and answers how many it took out of the listings. */
  async unlist(ids: string[]): Promise<number> {
    let unlisted = 0;

    for (let start = 0; start < ids.length; start += UNLISTED_TEMPLATES_PER_STATEMENT) {
      const rows = await this.#cursor
        .update(this.table)
        .set({ isListed: false })
        .where(
          and(
            inArray(this.table.id, ids.slice(start, start + UNLISTED_TEMPLATES_PER_STATEMENT)),
            isNotNull(this.table.importedRef),
            eq(this.table.isListed, true),
            eq(this.table.moderationStatus, "active")
          )
        )
        .returning({ id: this.table.id });
      unlisted += rows.length;
    }

    return unlisted;
  }

  get #storedColumns() {
    return {
      id: this.table.id,
      importedRef: this.table.importedRef,
      title: this.table.title,
      summary: this.table.summary,
      categories: this.table.categories,
      isListed: this.table.isListed,
      moderationStatus: this.table.moderationStatus,
      importedContentHash: this.table.importedContentHash,
      hasStaffCategories: sql<boolean>`exists (
        select 1 from ${this.moderationEvents}
        where ${this.moderationEvents.templateId} = ${this.table.id} and ${this.moderationEvents.action} = 'edit_categories'
      )`
    };
  }
}
