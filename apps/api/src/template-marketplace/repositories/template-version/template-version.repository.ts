import { and, desc, eq, sql } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";
import type { TemplateHardware } from "@src/template/types/template";
import type { AskedValue } from "@src/template-marketplace/lib/asked-values/asked-values.schema";
import type { TemplateVersionStatus } from "@src/template-marketplace/model-schemas/template-version/template-version.schema";

type Table = ApiPgTables["TemplateVersions"];
type TemplatesTable = ApiPgTables["Templates"];
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
  createdById: string | null;
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
};

const IMMUTABLE_MESSAGE = "Template versions are immutable";

@singleton()
export class TemplateVersionRepository extends BaseRepository<Table, TemplateVersionInput, TemplateVersionOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("TemplateVersions") protected readonly table: Table,
    @InjectPgTable("Templates") private readonly templates: TemplatesTable,
    protected readonly txManager: TxService
  ) {
    super(pg, table, txManager, "TemplateVersion", "TemplateVersions");
  }

  /** Versions carry no ability rules yet, so this returns an unfiltered copy rather than imply that reads are scoped. */
  accessibleBy(..._abilityParams: AbilityParams) {
    return new TemplateVersionRepository(this.pg, this.table, this.templates, this.txManager) as this;
  }

  /** Locks the template row first, so concurrent appends take their numbers one after another without blocking foreign key checks on it. */
  async appendVersion(input: AppendTemplateVersionInput): Promise<TemplateVersionOutput> {
    return await this.ensureTransaction(async tx => {
      await tx.select({ id: this.templates.id }).from(this.templates).where(eq(this.templates.id, input.templateId)).for("no key update");

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
          createdById: input.createdById
        })
        .returning();

      await tx.update(this.templates).set({ currentVersionId: row.id }).where(eq(this.templates.id, input.templateId));

      return this.toOutput(row);
    });
  }

  async findByTemplateAndVersion(templateId: string, version: number): Promise<TemplateVersionOutput | undefined> {
    const [row] = await this.cursor
      .select()
      .from(this.table)
      .where(and(eq(this.table.templateId, templateId), eq(this.table.version, version)));

    return row && this.toOutput(row);
  }

  async findCurrent(templateId: string): Promise<TemplateVersionOutput | undefined> {
    const [result] = await this.cursor
      .select({ version: this.table })
      .from(this.table)
      .innerJoin(this.templates, eq(this.templates.currentVersionId, this.table.id))
      .where(eq(this.templates.id, templateId));

    return result && this.toOutput(result.version);
  }

  async listByTemplate(templateId: string): Promise<TemplateVersionSummary[]> {
    return await this.cursor
      .select({
        id: this.table.id,
        templateId: this.table.templateId,
        version: this.table.version,
        resources: this.table.resources,
        status: this.table.status,
        createdById: this.table.createdById,
        createdAt: this.table.createdAt
      })
      .from(this.table)
      .where(eq(this.table.templateId, templateId))
      .orderBy(desc(this.table.version));
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

  protected toOutput(row: Partial<Row>): TemplateVersionOutput {
    const { checkResults: _checkResults, ...output } = row;
    return output as TemplateVersionOutput;
  }
}
