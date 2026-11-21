import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import createError from "http-errors";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { type ApiTransaction, TxService } from "@src/core/services";
import type { TemplateHardware } from "@src/template/types/template";
import type { AskedValue } from "@src/template-marketplace/lib/asked-values/asked-values.schema";
import { hasPassedPublishChecks, type PublishCheckResults } from "@src/template-marketplace/lib/publish-checks/publish-check-results";
import {
  summarizeVersionChanges,
  type TemplateVersionChange,
  type VersionContent
} from "@src/template-marketplace/lib/version-changes/summarize-version-changes";
import type { TemplateVersionHoldReason } from "@src/template-marketplace/lib/version-hold/version-hold-reasons";
import type { TemplateVersionStatus } from "@src/template-marketplace/model-schemas/template-version/template-version.schema";

type Table = ApiPgTables["TemplateVersions"];
type TemplatesTable = ApiPgTables["Templates"];
type UsersTable = ApiPgTables["Users"];
type Row = Table["$inferSelect"];

export type TemplateVersionInput = Partial<Table["$inferInsert"]>;

export type TemplateVersionOutput = {
  id: string;
  templateId: string;
  version: number;
  sdl: string;
  readme: string | null;
  askedValues: AskedValue[];
  resources: TemplateHardware | null;
  imageDigests: Record<string, string>;
  status: TemplateVersionStatus;
  /** Null on a version saved while the template was not public and never published since. */
  checkResults: PublishCheckResults | null;
  changes: TemplateVersionChange[] | null;
  /** Why the version was saved as `held`, null on a version that never waited for review. */
  holdReasons: TemplateVersionHoldReason[] | null;
  reviewedAt: Date | null;
  reviewNote: string | null;
  createdById: string | null;
  createdBy: { username: string } | null;
  createdAt: Date;
};

export type TemplateVersionSummary = Omit<TemplateVersionOutput, "sdl" | "readme" | "askedValues" | "imageDigests">;

export type AppendTemplateVersionInput = {
  templateId: string;
  sdl: string;
  readme?: string | null;
  askedValues?: AskedValue[];
  resources?: TemplateHardware | null;
  createdById?: string | null;
  expectedCurrentVersionId?: string;
  /** A version without a readme shows the legacy description, so readme changes are told between what readers see rather than the stored columns. */
  readmesShown?: { current: string | null; next: string | null };
  /** Given for a version of a public template; a version that failed them is stored without becoming the current one. */
  checkResults?: PublishCheckResults;
  /** Given for a version that passed its checks and still waits for staff; it is stored as `held` without becoming the current one. */
  holdReasons?: TemplateVersionHoldReason[];
};

export type NewestTemplateVersion = Pick<TemplateVersionOutput, "version" | "status">;

function statusOf({ checkResults, holdReasons }: AppendTemplateVersionInput): TemplateVersionStatus {
  if (checkResults && !hasPassedPublishChecks(checkResults)) return "failed_checks";

  return holdReasons?.length ? "held" : "live";
}

export const TEMPLATE_VERSION_CONFLICT_ERROR_CODE = "template_version_conflict";

const IMMUTABLE_MESSAGE = "Template versions are immutable";

@singleton()
export class TemplateVersionRepository extends BaseRepository<Table, TemplateVersionInput, TemplateVersionOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("TemplateVersions") protected readonly table: Table,
    @InjectPgTable("Templates") private readonly templates: TemplatesTable,
    @InjectPgTable("Users") private readonly users: UsersTable,
    protected readonly txManager: TxService
  ) {
    super(pg, table, txManager, "TemplateVersion", "TemplateVersions");
  }

  /** Versions carry no ability rules yet, so this returns an unfiltered copy rather than imply that reads are scoped. */
  accessibleBy(..._abilityParams: AbilityParams) {
    return new TemplateVersionRepository(this.pg, this.table, this.templates, this.users, this.txManager) as this;
  }

  /** Locks the template row first, so concurrent appends take their numbers one after another without blocking foreign key checks on it. */
  async appendVersion(input: AppendTemplateVersionInput): Promise<TemplateVersionOutput> {
    return await this.ensureTransaction(async tx => {
      const [template] = await tx
        .select({ currentVersionId: this.templates.currentVersionId })
        .from(this.templates)
        .where(eq(this.templates.id, input.templateId))
        .for("no key update");

      if (input.expectedCurrentVersionId !== undefined && template?.currentVersionId !== input.expectedCurrentVersionId) {
        throw createError(409, "The template has a newer version", { errorCode: TEMPLATE_VERSION_CONFLICT_ERROR_CODE });
      }

      const stored = template?.currentVersionId ? await this.#readContent(tx, template.currentVersionId) : undefined;
      const current = stored && input.readmesShown ? { ...stored, readme: input.readmesShown.current } : stored;
      const nextReadmeShown = input.readmesShown ? input.readmesShown.next : input.readme ?? null;

      const status = statusOf(input);

      const [{ next }] = await tx
        .select({ next: sql<number>`coalesce(max(${this.table.version}), 0) + 1` })
        .from(this.table)
        .where(eq(this.table.templateId, input.templateId));

      const [row] = await tx
        .insert(this.table)
        .values({
          templateId: input.templateId,
          version: Number(next),
          sdl: input.sdl,
          readme: input.readme,
          askedValues: input.askedValues,
          resources: input.resources,
          changes: summarizeVersionChanges(current, { sdl: input.sdl, readme: nextReadmeShown, askedValues: input.askedValues ?? [] }),
          checkResults: input.checkResults,
          status,
          holdReasons: status === "held" ? input.holdReasons : undefined,
          createdById: input.createdById
        })
        .returning();

      if (row.status === "live") {
        await tx.update(this.templates).set({ currentVersionId: row.id }).where(eq(this.templates.id, input.templateId));
      }

      return this.toOutput(row, await this.#readUsername(tx, row.createdById));
    });
  }

  async findById(id: string): Promise<TemplateVersionOutput | undefined> {
    const [result] = await this.cursor
      .select({ version: this.table, username: this.users.username })
      .from(this.table)
      .leftJoin(this.users, eq(this.users.id, this.table.createdById))
      .where(eq(this.table.id, id));

    return result && this.toOutput(result.version, result.username);
  }

  async findByTemplateAndVersion(templateId: string, version: number): Promise<TemplateVersionOutput | undefined> {
    const [result] = await this.cursor
      .select({ version: this.table, username: this.users.username })
      .from(this.table)
      .leftJoin(this.users, eq(this.users.id, this.table.createdById))
      .where(and(eq(this.table.templateId, templateId), eq(this.table.version, version)));

    return result && this.toOutput(result.version, result.username);
  }

  async findCurrent(templateId: string): Promise<TemplateVersionOutput | undefined> {
    const [result] = await this.cursor
      .select({ version: this.table, username: this.users.username })
      .from(this.table)
      .innerJoin(this.templates, eq(this.templates.currentVersionId, this.table.id))
      .leftJoin(this.users, eq(this.users.id, this.table.createdById))
      .where(eq(this.templates.id, templateId));

    return result && this.toOutput(result.version, result.username);
  }

  async listByTemplate(templateId: string): Promise<TemplateVersionSummary[]> {
    const rows = await this.cursor
      .select({
        id: this.table.id,
        templateId: this.table.templateId,
        version: this.table.version,
        resources: this.table.resources,
        status: this.table.status,
        checkResults: this.table.checkResults,
        changes: this.table.changes,
        holdReasons: this.table.holdReasons,
        reviewedAt: this.table.reviewedAt,
        reviewNote: this.table.reviewNote,
        createdById: this.table.createdById,
        username: this.users.username,
        createdAt: this.table.createdAt
      })
      .from(this.table)
      .leftJoin(this.users, eq(this.users.id, this.table.createdById))
      .where(eq(this.table.templateId, templateId))
      .orderBy(desc(this.table.version));

    return rows.map(({ username, ...row }) => ({ ...row, createdBy: username ? { username } : null }));
  }

  /** The one column written after a version is saved: what the publish gate found in content that stays as it was. */
  async recordCheckResults(id: string, checkResults: PublishCheckResults): Promise<void> {
    await this.cursor.update(this.table).set({ checkResults }).where(eq(this.table.id, id));
  }

  /** Keeps a digest already recorded, since only staff accepting an image change may move the one a version is held to. */
  async recordImageDigests(id: string, imageDigests: Record<string, string>): Promise<void> {
    await this.cursor
      .update(this.table)
      .set({ imageDigests: sql`${JSON.stringify(imageDigests)}::jsonb || ${this.table.imageDigests}` })
      .where(eq(this.table.id, id));
  }

  /** Unscoped, so it must run only for a version staff approved or rolled back to, on the template row the caller locked. */
  async makeCurrent(templateId: string, versionId: string): Promise<void> {
    await this.cursor.update(this.templates).set({ currentVersionId: versionId }).where(eq(this.templates.id, templateId));
  }

  /** A newer version that is live or still waiting for review is the one the publisher means to ship, so an older one approved late must not replace it. */
  async hasNewerLiveOrHeld(templateId: string, version: number): Promise<boolean> {
    const [newer] = await this.cursor
      .select({ id: this.table.id })
      .from(this.table)
      .where(and(eq(this.table.templateId, templateId), gt(this.table.version, version), inArray(this.table.status, ["live", "held"])))
      .limit(1);

    return !!newer;
  }

  async findNewestOf(templateIds: string[]): Promise<Map<string, NewestTemplateVersion>> {
    if (templateIds.length === 0) return new Map();

    const rows = await this.cursor
      .selectDistinctOn([this.table.templateId], { templateId: this.table.templateId, version: this.table.version, status: this.table.status })
      .from(this.table)
      .where(inArray(this.table.templateId, templateIds))
      .orderBy(this.table.templateId, desc(this.table.version));

    return new Map(rows.map(({ templateId, ...newest }) => [templateId, newest]));
  }

  async #readContent(tx: ApiTransaction, versionId: string): Promise<VersionContent | undefined> {
    const [content] = await tx
      .select({ sdl: this.table.sdl, readme: this.table.readme, askedValues: this.table.askedValues })
      .from(this.table)
      .where(eq(this.table.id, versionId));

    return content;
  }

  async #readUsername(tx: ApiTransaction, userId: string | null): Promise<string | null> {
    if (!userId) return null;

    const [user] = await tx.select({ username: this.users.username }).from(this.users).where(eq(this.users.id, userId));

    return user?.username ?? null;
  }

  async create(): Promise<never> {
    throw new Error(IMMUTABLE_MESSAGE);
  }

  async updateById(): Promise<never> {
    throw new Error(IMMUTABLE_MESSAGE);
  }

  async updateManyById(): Promise<never> {
    throw new Error(IMMUTABLE_MESSAGE);
  }

  async updateBy(): Promise<never> {
    throw new Error(IMMUTABLE_MESSAGE);
  }

  async deleteById(): Promise<never> {
    throw new Error(IMMUTABLE_MESSAGE);
  }

  async deleteBy(): Promise<never> {
    throw new Error(IMMUTABLE_MESSAGE);
  }

  protected toOutput(row: Partial<Row>, username?: string | null): TemplateVersionOutput {
    return { ...row, createdBy: username ? { username } : null } as TemplateVersionOutput;
  }
}
