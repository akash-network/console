import { and, eq, or, type SQL } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, type ApiPgTables, InjectPg, InjectPgTable } from "@src/core/providers";
import { OrgScopedRepository } from "@src/core/repositories/org-scoped.repository";
import { TxService } from "@src/core/services";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { writtenForTeamBy } from "@src/organization/lib/team-records/team-records";
import { TemplateVersions } from "@src/template-marketplace/model-schemas/template-version/template-version.schema";
import type { TemplateVisibility } from "@src/user/model-schemas/template/template.schema";
import { Users } from "@src/user/model-schemas/user/user.schema";

export interface TemplateOutput {
  id: string;
  /** Null on a team template whose author deleted their account. */
  userId: string | null;
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

type TemplateRecordInput = TemplateInput & {
  id?: string;
  userId?: string;
  copiedFromId?: string;
  projectId?: string;
  authorId?: string | null;
  visibility?: TemplateVisibility;
  isListed?: boolean;
};
type TemplateRow = ApiPgTables["Templates"]["$inferSelect"];

export interface TemplateVersionState {
  isPublic: boolean;
  visibility: TemplateVisibility;
  currentVersionId: string | null;
  currentVersionSdl: string | null;
}

interface TemplateFiling {
  authorId?: string | null;
  projectId?: string;
  copiedFromId?: string | null;
}

function visibilityOf(isPublic: boolean): { visibility: TemplateVisibility; isListed: boolean } {
  return { visibility: isPublic ? "public" : "private", isListed: !isPublic };
}

@singleton()
export class UserTemplateRepository extends OrgScopedRepository<ApiPgTables["Templates"], TemplateRecordInput, TemplateOutput> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("Templates") protected readonly table: ApiPgTables["Templates"],
    @InjectPgTable("TemplateFavorites") private readonly favoriteTable: ApiPgTables["TemplateFavorites"],
    protected readonly txManager: TxService,
    protected readonly executionContextService: ExecutionContextService
  ) {
    super(pg, table, txManager, executionContextService, "Template", "Templates");
  }

  protected newInstance() {
    return new UserTemplateRepository(this.pg, this.table, this.favoriteTable, this.txManager, this.executionContextService) as this;
  }

  protected get filesIntoProjects() {
    return true;
  }

  async findById(id: string, readerUserId = ""): Promise<TemplateOutput | undefined> {
    return await this.#findOne(and(eq(this.table.id, id), this.#readableBy(readerUserId)));
  }

  async findAllByUserId(userId: string): Promise<TemplateOutput[]> {
    const items = await this.cursor.query.Templates.findMany({
      where: this.whereAccessibleBy(eq(this.table.userId, userId)),
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
      .where(this.unscoped("public-templates").whereAccessibleBy(and(eq(Users.username, username), eq(this.table.isPublic, true))));
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

  async addFavorite(userId: string, templateId: string, readerUserId = userId): Promise<void> {
    if (!(await this.findById(templateId, readerUserId))) return;

    await this.cursor.insert(this.favoriteTable).values({ id: randomUUID(), userId, templateId, addedDate: new Date() }).onConflictDoNothing();
  }

  async removeFavorite(userId: string, templateId: string): Promise<void> {
    await this.cursor.delete(this.favoriteTable).where(and(eq(this.favoriteTable.userId, userId), eq(this.favoriteTable.templateId, templateId)));
  }

  async getFavoriteTemplates(userId: string, readerUserId = userId): Promise<TemplateOutput[]> {
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
      .leftJoin(Users, eq(this.table.userId, Users.userId))
      .where(and(eq(this.favoriteTable.userId, userId), this.#readableBy(readerUserId)));
    return items.map(item => this.#toFullOutput(item, item.username));
  }

  /** Looks past the caller's rules, so a template the author may no longer change is refused rather than copied. */
  async isAuthoredBy(id: string, userId: string): Promise<boolean> {
    const [template] = await this.cursor.select({ id: this.table.id }).from(this.table).where(this.#authoredBy(id, userId)).limit(1);

    return !!template;
  }

  /** Locks the template row without blocking foreign key checks on it, then reads its current version in a second statement that sees whatever a competing save committed meanwhile. */
  async findVersionState(id: string, userId: string): Promise<TemplateVersionState | undefined> {
    const [state] = await this.cursor
      .select({ isPublic: this.table.isPublic, visibility: this.table.visibility, currentVersionId: this.table.currentVersionId })
      .from(this.table)
      .where(this.#authoredBy(id, userId))
      .limit(1)
      .for("no key update");

    if (!state) return undefined;

    return { ...state, currentVersionSdl: state.currentVersionId ? await this.#findVersionSdl(state.currentVersionId) : null };
  }

  async createTemplate(userId: string, data: TemplateInput, { projectId, copiedFromId, authorId }: TemplateFiling = {}): Promise<string> {
    const created = await this.create({
      ...data,
      id: randomUUID(),
      userId,
      projectId,
      copiedFromId: copiedFromId || undefined,
      authorId,
      ...visibilityOf(!!data.isPublic)
    });

    return created.id;
  }

  async updateTemplate(id: string, userId: string, data: Partial<TemplateInput>): Promise<void> {
    await this.updateWhere(this.#authoredBy(id, userId), data.isPublic === undefined ? data : { ...data, ...visibilityOf(data.isPublic) });
  }

  async detachFromTeams(userId: string): Promise<void> {
    await this.cursor
      .update(this.table)
      .set({ userId: null })
      .where(this.unscoped("account-deletion").whereAccessibleBy(writtenForTeamBy(this.table, userId)));
  }

  async deleteAllOwnedBy(userId: string): Promise<void> {
    await this.cursor.delete(this.favoriteTable).where(eq(this.favoriteTable.userId, userId));
    await this.cursor.delete(this.table).where(this.unscoped("account-deletion").whereAccessibleBy(eq(this.table.userId, userId)));
  }

  async deleteById(id: string | string[], userId?: string): Promise<void> {
    if (typeof id === "string" && userId) {
      await this.writeChecked(cursor => cursor.delete(this.table).where(this.#authoredBy(id, userId)).returning());
    } else {
      await super.deleteById(id);
    }
  }

  protected toOutput(payload: Partial<TemplateRow>): TemplateOutput {
    return this.#toFullOutput(payload as TemplateRow, "");
  }

  async #findVersionSdl(versionId: string): Promise<string | null> {
    const [version] = await this.cursor.select({ sdl: TemplateVersions.sdl }).from(TemplateVersions).where(eq(TemplateVersions.id, versionId));

    return version?.sdl ?? null;
  }

  async #findOne(where: SQL | undefined): Promise<TemplateOutput | undefined> {
    const item = await this.cursor.query.Templates.findFirst({
      where,
      with: { user: { columns: { username: true } } }
    });
    if (!item) return undefined;
    return this.#toFullOutput(item, item.user?.username);
  }

  /** Public templates are readable by anyone; a private one only by its author, inside the active organization in organization mode and within the rules attached. */
  #readableBy(readerUserId: string) {
    return or(eq(this.table.isPublic, true), this.#privateTemplatesOf(readerUserId));
  }

  #privateTemplatesOf(readerUserId: string) {
    return readerUserId ? this.whereAccessibleBy(eq(this.table.userId, readerUserId)) : undefined;
  }

  #authoredBy(id: string, userId: string) {
    return this.whereInOrganization(and(eq(this.table.id, id), eq(this.table.userId, userId)));
  }

  #toFullOutput(template: Partial<TemplateRow>, username?: string | null): TemplateOutput {
    return {
      id: template.id!,
      userId: template.userId ?? null,
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
