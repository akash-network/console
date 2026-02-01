import { Template, TemplateFavorite, UserSetting } from "@akashnetwork/database/dbSchemas/user";

import { toUTC } from "@src/utils";

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

export class UserTemplateRepository {
  async findById(id: string): Promise<TemplateOutput | undefined> {
    const template = await Template.findOne({
      include: [{ model: UserSetting, required: true, attributes: ["id", "username"] }],
      where: {
        id
      }
    });

    if (!template) return undefined;

    return this.#toOutput(template);
  }

  async isFavorite(templateId: string, requestedUserId: string): Promise<boolean> {
    const templateFavorite = await TemplateFavorite.findOne({
      raw: true,
      attributes: ["id"],
      where: {
        templateId,
        userId: requestedUserId
      }
    });
    return !!templateFavorite;
  }

  async deleteById(id: string, userId: string): Promise<void> {
    await Template.destroy({ where: { userId, id } });
  }

  async removeFavorite(userId: string, templateId: string): Promise<void> {
    await TemplateFavorite.destroy({ where: { userId, templateId } });
  }

  async addFavorite(userId: string, templateId: string): Promise<void> {
    const template = await TemplateFavorite.findOne({
      where: {
        templateId,
        userId
      },
      raw: true,
      attributes: ["id"]
    });

    if (template) {
      return;
    }

    await TemplateFavorite.create(
      {
        id: crypto.randomUUID(),
        userId,
        templateId,
        addedDate: toUTC(new Date())
      },
      { ignoreDuplicates: true }
    );
  }

  async getFavoriteTemplates(userId: string): Promise<TemplateOutput[]> {
    const templateFavorites = await TemplateFavorite.findAll({
      attributes: ["id"],
      include: [{ model: Template, required: true }],
      where: {
        userId
      }
    });

    return templateFavorites.map(t => this.#toOutput(t.template));
  }

  async upsert(id: string, userId: string, data: TemplateInput): Promise<string> {
    let template = id
      ? await Template.findOne({
          where: {
            id,
            userId
          }
        })
      : undefined;

    if (!template) {
      template = Template.build({
        id: crypto.randomUUID(),
        userId
      });

      if (id) {
        template.copiedFromId = id;
      }
    }

    template.sdl = data.sdl;
    template.title = data.title;
    template.cpu = data.cpu;
    template.ram = data.ram;
    template.storage = data.storage;
    if (Object.hasOwn(data, "isPublic")) {
      template.isPublic = !!data.isPublic;
    }
    if (Object.hasOwn(data, "description")) {
      template.description = data.description;
    }

    await template.save();

    return template.id;
  }

  async updateById(id: string, userId: string, data: Partial<TemplateInput>): Promise<void> {
    await Template.update(data, { where: { id, userId } });
  }

  async findAllByUsername(username: string): Promise<TemplateOutput[]> {
    const user = await UserSetting.findOne({
      attributes: ["id", "username"],
      include: [
        {
          model: Template,
          required: false,
          where: {
            isPublic: true
          }
        }
      ],
      where: {
        username: username
      }
    });

    if (!user?.templates?.length) {
      return [];
    }

    return user.templates.map(t => this.#toOutput({ ...t, userSetting: user } as Template));
  }

  async findAllByUserId(userId: string): Promise<TemplateOutput[]> {
    const templates = await Template.findAll({
      where: { userId },
      include: [{ model: UserSetting, required: true, attributes: ["id", "username"] }]
    });

    if (!templates?.length) {
      return [];
    }

    return templates.map(t => this.#toOutput(t));
  }

  #toOutput(template: Template): TemplateOutput {
    return {
      id: template.id,
      userId: template.userId,
      title: template.title,
      description: template.description || "",
      cpu: template.cpu,
      ram: template.ram,
      storage: template.storage,
      sdl: template.sdl,
      username: template.userSetting?.username,
      isPublic: template.isPublic
    };
  }
}
