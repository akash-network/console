import assert from "http-assert";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { TxService } from "@src/core/services";
import { DeploymentProjectService } from "@src/deployment/services/deployment-project/deployment-project.service";
import { summarizeTemplateHardware } from "@src/template/utils/template-hardware/template-hardware";
import { TemplateVersionRepository } from "@src/template-marketplace/repositories/template-version/template-version.repository";
import { TemplateInput, type TemplateOutput, type TemplateVersionState, UserTemplateRepository } from "../../repositories/user-template/user-template.repository";

type TemplateWriteAction = "create" | "update" | "delete";

function withoutUnchangedIsPublic({ isPublic, ...rest }: TemplateInput, stored: TemplateVersionState): Partial<TemplateInput> {
  return isPublic === undefined || isPublic === stored.isPublic ? rest : { ...rest, isPublic };
}

@singleton()
export class UserTemplatesService {
  readonly #userTemplateRepository: UserTemplateRepository;
  readonly #authService: AuthService;
  readonly #deploymentProjectService: DeploymentProjectService;
  readonly #templateVersionRepository: TemplateVersionRepository;
  readonly #txService: TxService;

  constructor(
    userTemplateRepository: UserTemplateRepository,
    authService: AuthService,
    deploymentProjectService: DeploymentProjectService,
    templateVersionRepository: TemplateVersionRepository,
    txService: TxService
  ) {
    this.#userTemplateRepository = userTemplateRepository;
    this.#authService = authService;
    this.#deploymentProjectService = deploymentProjectService;
    this.#templateVersionRepository = templateVersionRepository;
    this.#txService = txService;
  }

  async getTemplateById(id: string, userId: string = ""): Promise<(TemplateOutput & { isFavorite?: boolean }) | null> {
    const readerUserId = this.#readerOf(userId);
    const template = await this.#readableBy(readerUserId).findById(id, readerUserId);
    if (!template) return null;

    if (userId) {
      const isFavorite = await this.#userTemplateRepository.isFavorite(id, userId);
      return { ...template, isFavorite };
    }

    return template;
  }

  async getTemplates(username: string, userId: string = ""): Promise<TemplateOutput[]> {
    if (!userId) {
      return await this.#userTemplateRepository.findAllByUsername(username);
    }

    const readerUserId = this.#readerOf(userId);

    return readerUserId ? await this.#readableBy(readerUserId).findAllByUserId(readerUserId) : [];
  }

  async saveTemplate(id: string | undefined | null, userId: string, { projectId, ...template }: TemplateInput & { projectId?: string }): Promise<string> {
    if (id && (await this.#userTemplateRepository.isAuthoredBy(id, userId))) {
      await this.#updateAndVersion(id, userId, template);
      return id;
    }

    const repository = this.#writableBy("create");
    const filingProjectId = await this.#deploymentProjectService.resolveFilingProject(projectId, "Template");

    return await this.#txService.transaction(async () => {
      const templateId = await repository.createTemplate(userId, template, { projectId: filingProjectId, copiedFromId: id });
      await this.#recordVersion(templateId, template.sdl);

      return templateId;
    });
  }

  async update(id: string, userId: string, data: Partial<TemplateInput>): Promise<void> {
    await this.#writableBy("update").updateTemplate(id, userId, data);
  }

  async deleteTemplate(userId: string, id: string): Promise<void> {
    await this.#writableBy("delete").deleteById(id, userId);
  }

  async getFavoriteTemplates(userId: string): Promise<Pick<TemplateOutput, "id" | "title" | "description">[]> {
    const readerUserId = this.#readerOf(userId);
    const templates = await this.#readableBy(readerUserId).getFavoriteTemplates(userId, readerUserId);

    return templates.map(t => ({
      id: t.id,
      title: t.title,
      description: t.description
    }));
  }

  async addFavoriteTemplate(userId: string, templateId: string): Promise<void> {
    const readerUserId = this.#readerOf(userId);
    await this.#readableBy(readerUserId).addFavorite(userId, templateId, readerUserId);
  }

  async removeFavoriteTemplate(userId: string, templateId: string): Promise<void> {
    await this.#userTemplateRepository.removeFavorite(userId, templateId);
  }

  async #updateAndVersion(id: string, userId: string, template: TemplateInput): Promise<void> {
    const repository = this.#writableBy("update");

    await this.#txService.transaction(async () => {
      const stored = await this.#userTemplateRepository.findVersionState(id, userId);
      assert(stored, 404, "Template not found");

      await repository.updateTemplate(id, userId, withoutUnchangedIsPublic(template, stored));

      if (!stored.currentVersionId || stored.sdl !== template.sdl) {
        await this.#recordVersion(id, template.sdl);
      }
    });
  }

  async #recordVersion(templateId: string, sdl: string): Promise<void> {
    await this.#templateVersionRepository.appendVersion({
      templateId,
      sdl,
      resources: summarizeTemplateHardware(sdl),
      createdById: this.#authService.currentUser.id
    });
  }

  /** A caller whose rules reach no template, such as a billing member of a team, reads public templates only. */
  #readerOf(userId: string): string {
    return userId && this.#authService.ability.can("read", "Template") ? userId : "";
  }

  #readableBy(readerUserId: string): UserTemplateRepository {
    return readerUserId ? this.#userTemplateRepository.accessibleBy(this.#authService.ability, "read") : this.#userTemplateRepository;
  }

  #writableBy(action: TemplateWriteAction): UserTemplateRepository {
    return this.#userTemplateRepository.accessibleBy(this.#authService.ability, action);
  }
}
