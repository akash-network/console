import { and, eq, inArray, isNotNull, isNull, type SQL, sql } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { TxService } from "@src/core/services";
import type { TemplateRemovedBy } from "@src/user/model-schemas/template/template.schema";

export type RemovedTemplateRow = { id: string; title: string; publishedAt: Date | null; removedAt: Date | null };

/** Unscoped and unruled, so every method must run only after its caller authorized the removal, and inside that caller's transaction. */
@singleton()
export class TemplateRemovalRepository {
  constructor(
    @InjectPg() private readonly pg: ApiPgDatabase,
    @InjectPgTable("Templates") private readonly templates: ApiPgTables["Templates"],
    @InjectPgTable("TemplateVersions") private readonly versions: ApiPgTables["TemplateVersions"],
    @InjectPgTable("TemplateFavorites") private readonly favorites: ApiPgTables["TemplateFavorites"],
    @InjectPgTable("TemplateTombstones") private readonly tombstones: ApiPgTables["TemplateTombstones"],
    private readonly txManager: TxService
  ) {}

  get #cursor() {
    return this.txManager.getPgTx() || this.pg;
  }

  /** A template that was ever public keeps its emptied row, so its link can say it was removed; one that never was is deleted with its versions and favorites. */
  async remove(id: string, removedBy: TemplateRemovedBy): Promise<void> {
    const emptiedCount = await this.#empty(and(eq(this.templates.id, id), isNotNull(this.templates.publishedAt)), removedBy);

    if (emptiedCount === 0) await this.#cursor.delete(this.templates).where(eq(this.templates.id, id));
  }

  async removeAllOfOrganization(organizationId: string, removedBy: TemplateRemovedBy): Promise<void> {
    const inOrganization = eq(this.templates.organizationId, organizationId);

    await this.#empty(and(inOrganization, isNotNull(this.templates.publishedAt)), removedBy);
    await this.#cursor.delete(this.templates).where(and(inOrganization, isNull(this.templates.publishedAt)));
  }

  /** Finishes a removal that only marked the row, which is all the admin app writes; who removed it is kept when the row already says. */
  async emptyRemoved(id: string, removedBy: TemplateRemovedBy): Promise<boolean> {
    const emptiedCount = await this.#empty(and(eq(this.templates.id, id), eq(this.templates.moderationStatus, "removed")), removedBy);

    return emptiedCount > 0;
  }

  /** Keeps the removed page of once-public templates whose rows are already deleted, as happens when their owner's account goes. */
  async keepRemovedPagesOf(deleted: RemovedTemplateRow[]): Promise<void> {
    const everPublic = deleted.filter(template => template.publishedAt);

    if (everPublic.length === 0) return;

    await this.#cursor
      .insert(this.tombstones)
      .values(everPublic.map(({ id, title, removedAt }) => ({ templateId: id, title, ...(removedAt && { removedAt }) })))
      .onConflictDoNothing();
  }

  /** Answers the title only for a template that was once public, so a removed template nobody outside could read stays unknown. */
  async findRemovedTitle(id: string): Promise<string | undefined> {
    const [removed] = await this.#cursor
      .select({ title: this.templates.title })
      .from(this.templates)
      .where(and(eq(this.templates.id, id), eq(this.templates.moderationStatus, "removed"), isNotNull(this.templates.publishedAt)))
      .limit(1);

    if (removed) return removed.title;

    const [tombstone] = await this.#cursor.select({ title: this.tombstones.title }).from(this.tombstones).where(eq(this.tombstones.templateId, id)).limit(1);

    return tombstone?.title;
  }

  /** Drops everything users wrote but the title, on the row and on every version, and keeps the ids that reports, usage events and deployments name. */
  async #empty(where: SQL | undefined, removedBy: TemplateRemovedBy): Promise<number> {
    const emptied = await this.#cursor
      .update(this.templates)
      .set({
        moderationStatus: "removed",
        removedAt: sql`coalesce(${this.templates.removedAt}, now())`,
        removedBy: sql`coalesce(${this.templates.removedBy}, ${removedBy})`,
        sdl: "",
        description: null,
        summary: null,
        icon: null,
        categories: [],
        cpu: 0,
        ram: 0,
        storage: 0,
        visibility: "private",
        isPublic: false,
        isListed: false,
        isOfficial: false,
        isFeatured: false
      })
      .where(where)
      .returning({ id: this.templates.id });
    const ids = emptied.map(template => template.id);

    if (ids.length === 0) return 0;

    await this.#cursor
      .update(this.versions)
      .set({ sdl: "", readme: null, askedValues: [], resources: null, imageDigests: {}, checkResults: null, changes: null, reviewNote: null })
      .where(inArray(this.versions.templateId, ids));
    await this.#cursor.delete(this.favorites).where(inArray(this.favorites.templateId, ids));

    return ids.length;
  }
}
