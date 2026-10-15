import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { DeploymentProjectService } from "@src/deployment/services/deployment-project/deployment-project.service";
import { TemplateInput, type TemplateOutput, UserTemplateRepository } from "../../repositories/user-template/user-template.repository";

type TemplateWriteAction = "create" | "update" | "delete";

@singleton()
export class UserTemplatesService {
  readonly #userTemplateRepository: UserTemplateRepository;
  readonly #authService: AuthService;
  readonly #deploymentProjectService: DeploymentProjectService;

  constructor(userTemplateRepository: UserTemplateRepository, authService: AuthService, deploymentProjectService: DeploymentProjectService) {
    this.#userTemplateRepository = userTemplateRepository;
    this.#authService = authService;
    this.#deploymentProjectService = deploymentProjectService;
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
      await this.#writableBy("update").updateTemplate(id, userId, template);
      return id;
    }

    const repository = this.#writableBy("create");
    const filingProjectId = await this.#deploymentProjectService.resolveFilingProject(projectId, "Template");

    return await repository.createTemplate(userId, template, { projectId: filingProjectId, copiedFromId: id });
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
