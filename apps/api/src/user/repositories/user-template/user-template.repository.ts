import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";
import { Users } from "@src/user/model-schemas/user/user.schema";

export interface TemplateOutput {
  id: string;
  userId: string;
  title: string;
  description: string;
  cpu: number;
  ram: number;
  storage: number;
  sdl: string;
  username: string;
  isPublic: boolean;
}

export interface TemplateInput {
  sdl: string;
  title: string;
  cpu: number;
  ram: number;
  storage: number;
  isPublic?: boolean;
  description?: string;
}

type TemplateRecordInput = TemplateInput & { id?: string };
type TemplateRow = ApiPgTables["Templates"]["$inferSelect"];

@singleton()
export class UserTemplateRepository extends BaseRepository<ApiPgTables["Templates"], TemplateRecordInput, TemplateOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("Templates") protected readonly table: ApiPgTables["Templates"],
    @InjectPgTable("TemplateFavorites") private readonly favoriteTable: ApiPgTables["TemplateFavorites"],
    protected readonly txManager: TxService
  ) {
    super(pg, table, txManager, "Template", "Templates");
  }

  accessibleBy(...abilityParams: AbilityParams) {
    return new UserTemplateRepository(this.pg, this.table, this.favoriteTable, this.txManager).withAbility(...abilityParams) as this;
  }

  async findById(id: string): Promise<TemplateOutput | undefined> {
    const item = await this.cursor.query.Templates.findFirst({
      where: eq(this.table.id, id),
      with: { user: { columns: { username: true } } }
    });
    if (!item) return undefined;
    return this.#toFullOutput(item, item.user?.username);
  }

  async findAllByUserId(userId: string): Promise<TemplateOutput[]> {
    const items = await this.cursor.query.Templates.findMany({
      where: eq(this.table.userId, userId),
      with: { user: { columns: { username: true } } }
    });
    return items.map(item => this.#toFullOutput(item, item.user?.username));
  }

  async findAllByUsername(username: string): Promise<TemplateOutput[]> {
    const items = await this.cursor
      .select({
        id: this.table.id,
        userId: this.table.userId,
        copiedFromId: this.table.copiedFromId,
        title: this.table.title,
        description: this.table.description,
        isPublic: this.table.isPublic,
        cpu: this.table.cpu,
        ram: this.table.ram,
        storage: this.table.storage,
        sdl: this.table.sdl,
        username: Users.username
      })
      .from(this.table)
      .innerJoin(Users, eq(this.table.userId, Users.userId))
      .where(and(eq(Users.username, username), eq(this.table.isPublic, true)));
    return items.map(item => this.#toFullOutput(item, item.username));
  }

  async isFavorite(templateId: string, requestedUserId: string): Promise<boolean> {
    const [result] = await this.cursor
      .select({ id: this.favoriteTable.id })
      .from(this.favoriteTable)
      .where(and(eq(this.favoriteTable.templateId, templateId), eq(this.favoriteTable.userId, requestedUserId)))
      .limit(1);
    return !!result;
  }

  async addFavorite(userId: string, templateId: string): Promise<void> {
    await this.cursor.insert(this.favoriteTable).values({ id: randomUUID(), userId, templateId, addedDate: new Date() }).onConflictDoNothing();
  }

  async removeFavorite(userId: string, templateId: string): Promise<void> {
    await this.cursor.delete(this.favoriteTable).where(and(eq(this.favoriteTable.userId, userId), eq(this.favoriteTable.templateId, templateId)));
  }

  async getFavoriteTemplates(userId: string): Promise<TemplateOutput[]> {
    const items = await this.cursor
      .select({
        id: this.table.id,
        userId: this.table.userId,
        copiedFromId: this.table.copiedFromId,
        title: this.table.title,
        description: this.table.description,
        isPublic: this.table.isPublic,
        cpu: this.table.cpu,
        ram: this.table.ram,
        storage: this.table.storage,
        sdl: this.table.sdl,
        username: Users.username
      })
      .from(this.favoriteTable)
      .innerJoin(this.table, eq(this.favoriteTable.templateId, this.table.id))
      .innerJoin(Users, eq(this.table.userId, Users.userId))
      .where(eq(this.favoriteTable.userId, userId));
    return items.map(item => this.#toFullOutput(item, item.username));
  }

  async upsert(id: string | null | undefined, userId: string, data: TemplateInput): Promise<string> {
    if (id) {
      const existing = await this.cursor.query.Templates.findFirst({
        where: and(eq(this.table.id, id), eq(this.table.userId, userId)),
        columns: { id: true }
      });

      if (existing) {
        await this.cursor.update(this.table).set(data).where(eq(this.table.id, existing.id));
        return existing.id;
      }
    }

    const [created] = await this.cursor
      .insert(this.table)
      .values({ id: randomUUID(), userId, copiedFromId: id || undefined, ...data })
      .returning({ id: this.table.id });
    return created.id;
  }

  async updateTemplate(id: string, userId: string, data: Partial<TemplateInput>): Promise<void> {
    await this.cursor
      .update(this.table)
      .set(data)
      .where(and(eq(this.table.id, id), eq(this.table.userId, userId)));
  }

  async deleteById(id: string | string[], userId?: string): Promise<void> {
    if (typeof id === "string" && userId) {
      await this.cursor.delete(this.table).where(and(eq(this.table.id, id), eq(this.table.userId, userId)));
    } else {
      await super.deleteById(id);
    }
  }

  protected toOutput(payload: Partial<TemplateRow>): TemplateOutput {
    return this.#toFullOutput(payload as TemplateRow, "");
  }

  #toFullOutput(template: Partial<TemplateRow>, username?: string | null): TemplateOutput {
    return {
      id: template.id!,
      userId: template.userId!,
      title: template.title!,
      description: template.description ?? "",
      cpu: template.cpu!,
      ram: template.ram!,
      storage: template.storage!,
      sdl: template.sdl!,
      username: username ?? "",
      isPublic: template.isPublic!
    };
  }
}
