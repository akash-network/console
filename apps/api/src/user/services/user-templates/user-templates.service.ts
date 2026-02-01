import { singleton } from "tsyringe";

import { TemplateInput, type TemplateOutput, UserTemplateRepository } from "../../repositories/user-template/user-template.repository";

@singleton()
export class UserTemplatesService {
  readonly #userTemplateRepository: UserTemplateRepository;

  constructor(userTemplateRepository: UserTemplateRepository) {
    this.#userTemplateRepository = userTemplateRepository;
  }

  async getTemplateById(id: string, userId: string = ""): Promise<(TemplateOutput & { isFavorite?: boolean }) | null> {
    const template = await this.#userTemplateRepository.findById(id);
    if (!template || (!template.isPublic && template.userId !== userId)) return null;

    if (userId) {
      const isFavorite = await this.#userTemplateRepository.isFavorite(id, userId);
      return { ...template, isFavorite };
    }

    return template;
  }

  async getTemplates(username: string, userId: string = ""): Promise<TemplateOutput[]> {
    if (userId) {
      return this.#userTemplateRepository.findAllByUserId(userId);
    }

    const templates = await this.#userTemplateRepository.findAllByUsername(username);
    return templates;
  }

  async saveTemplate(id: string, userId: string, data: TemplateInput): Promise<string> {
    return this.#userTemplateRepository.upsert(id, userId, data);
  }

  async update(id: string, userId: string, data: Partial<TemplateInput>): Promise<void> {
    await this.#userTemplateRepository.updateById(id, userId, data);
  }

  async deleteTemplate(userId: string, id: string): Promise<void> {
    await this.#userTemplateRepository.deleteById(id, userId);
  }

  async getFavoriteTemplates(userId: string): Promise<Pick<TemplateOutput, "id" | "title" | "description">[]> {
    const templates = await this.#userTemplateRepository.getFavoriteTemplates(userId);

    return templates.map(t => ({
      id: t.id,
      title: t.title,
      description: t.description
    }));
  }

  async addFavoriteTemplate(userId: string, templateId: string): Promise<void> {
    await this.#userTemplateRepository.addFavorite(userId, templateId);
  }

  async removeFavoriteTemplate(userId: string, templateId: string): Promise<void> {
    await this.#userTemplateRepository.removeFavorite(userId, templateId);
  }
}
