import { and, desc, eq, sql } from "drizzle-orm";
import createError from "http-errors";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { type ApiTransaction, TxService } from "@src/core/services";
import type { TemplateHardware } from "@src/template/types/template";
import type { AskedValue } from "@src/template-marketplace/lib/asked-values/asked-values.schema";
import {
  summarizeVersionChanges,
  type TemplateVersionChange,
  type VersionContent
} from "@src/template-marketplace/lib/version-changes/summarize-version-changes";
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
  changes: TemplateVersionChange[] | null;
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
};

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
          createdById: input.createdById
        })
        .returning();

      await tx.update(this.templates).set({ currentVersionId: row.id }).where(eq(this.templates.id, input.templateId));

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
        changes: this.table.changes,
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
    const { checkResults: _checkResults, ...output } = row;
    return { ...output, createdBy: username ? { username } : null } as TemplateVersionOutput;
  }
}
