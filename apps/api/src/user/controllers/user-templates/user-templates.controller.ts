import assert from "http-assert";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { UserTemplatesService } from "@src/user/services/user-templates/user-templates.service";

@singleton()
export class UserTemplatesController {
  constructor(
    private readonly authService: AuthService,
    private readonly userTemplatesService: UserTemplatesService
  ) {}

  async getTemplateById(templateId: string, userId: string = "") {
    const template = await this.userTemplatesService.getTemplateById(templateId, userId);
    assert(template, 404, "Template not found");
    return template;
  }

  async saveTemplate(data: {
    id: string;
    sdl: string;
    isPublic: boolean;
    title: string;
    cpu: number;
    ram: number;
    storage: number;
  }) {
    assert(this.authService.currentUser, 401);
    const userId = this.authService.currentUser.userId;
    return await this.userTemplatesService.saveTemplate(data.id, userId, data.sdl, data.title, data.cpu, data.ram, data.storage, data.isPublic);
  }

  async saveTemplateDesc(data: { id: string; description: string }) {
    assert(this.authService.currentUser, 401);
    const userId = this.authService.currentUser.userId;
    await this.userTemplatesService.saveTemplateDesc(data.id, userId, data.description);
  }

  async getTemplates(username: string, userId: string = "") {
    const templates = await this.userTemplatesService.getTemplates(username, userId);
    assert(templates, 404, "User not found.");
    return templates;
  }

  async deleteTemplate(templateId: string) {
    assert(this.authService.currentUser, 401);
    const userId = this.authService.currentUser.userId;
    await this.userTemplatesService.deleteTemplate(userId, templateId);
  }

  async getFavoriteTemplates() {
    assert(this.authService.currentUser, 401);
    const userId = this.authService.currentUser.userId;
    return await this.userTemplatesService.getFavoriteTemplates(userId);
  }

  async addFavoriteTemplate(templateId: string) {
    assert(this.authService.currentUser, 401);
    const userId = this.authService.currentUser.userId;
    await this.userTemplatesService.addFavoriteTemplate(userId, templateId);
  }

  async removeFavoriteTemplate(templateId: string) {
    assert(this.authService.currentUser, 401);
    const userId = this.authService.currentUser.userId;
    await this.userTemplatesService.removeFavoriteTemplate(userId, templateId);
  }
}
