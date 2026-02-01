import { Template, TemplateFavorite, UserSetting } from "@akashnetwork/database/dbSchemas/user";
import { Op } from "sequelize";
import { singleton } from "tsyringe";

import { toUTC } from "@src/utils";

@singleton()
export class UserTemplatesService {
  async getTemplateById(id: string, userId: string = "") {
    const template = await Template.findOne({
      include: [
        { model: UserSetting, required: true },
        { model: TemplateFavorite, required: false, where: { userId: userId } }
      ],
      where: {
        id
      }
    });

    if (!template || (!template.isPublic && template.userId !== userId)) return null;

    return {
      id: template.id,
      userId: template.userId,
      title: template.title,
      description: template.description,
      cpu: template.cpu,
      ram: template.ram,
      storage: template.storage,
      sdl: template.sdl,
      username: template.userSetting.username,
      isPublic: template.isPublic,
      isFavorite: template.templateFavorites?.length > 0 ? true : false
    };
  }

  async getTemplates(username: string, userId: string = "") {
    const user = await UserSetting.findOne({
      include: [
        {
          model: Template,
          required: false,
          // TODO fix this typing https://github.com/sequelize/sequelize-typescript/issues/1095
          where: {
            [Op.or]: [{ isPublic: true }, { userId: userId }] as any // eslint-disable-line @typescript-eslint/no-explicit-any
          }
        }
      ],
      where: {
        username: username
      }
    });

    if (!user) {
      return null;
    }

    return user.templates || [];
  }

  async saveTemplate(
    id: string,
    userId: string,
    data: {
      sdl: string;
      title: string;
      cpu: number;
      ram: number;
      storage: number;
      isPublic: boolean;
    }
  ) {
    let template = await Template.findOne({
      where: {
        id: id || null,
        userId
      }
    });

    if (!id || !template) {
      // Create
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
    template.isPublic = data.isPublic;
    await template.save();

    return template.id;
  }

  async saveTemplateDesc(id: string, userId: string, description: string = "") {
    const template = await Template.findOne({
      where: {
        id,
        userId
      }
    });

    if (!id || !template) {
      return;
    }

    template.description = description;

    await template.save();
  }

  async deleteTemplate(userId: string, id: string) {
    await Template.destroy({ where: { userId, id } });
  }

  async getFavoriteTemplates(userId: string) {
    const templateFavorites = await TemplateFavorite.findAll({
      include: [{ model: Template, required: true }],
      where: {
        userId: userId
      }
    });

    return templateFavorites.map(t => ({
      id: t.template.id,
      title: t.template.title,
      description: t.template.description
    }));
  }

  async addFavoriteTemplate(userId: string, templateId: string) {
    const template = await TemplateFavorite.findOne({
      where: {
        templateId,
        userId
      }
    });

    if (template) {
      return;
    }

    await TemplateFavorite.create({
      id: crypto.randomUUID(),
      userId,
      templateId,
      addedDate: toUTC(new Date())
    });
  }

  async removeFavoriteTemplate(userId: string, templateId: string) {
    await TemplateFavorite.destroy({ where: { userId, templateId } });
  }
}
