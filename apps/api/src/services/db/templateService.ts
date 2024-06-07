import { Template, TemplateFavorite, UserSetting } from "@akashnetwork/cloudmos-shared/dbSchemas/user";
import { Op } from "sequelize";
import * as uuid from "uuid";

import { toUTC } from "@src/utils";

export async function getTemplateById(id: string, userId: string = "") {
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

export async function getTemplates(username: string, userId: string = "") {
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

export async function saveTemplate(
  id: string,
  userId: string,
  sdl: string,
  title: string,
  cpu: number,
  ram: number,
  storage: number,
  isPublic: boolean = false
) {
  let template = await Template.findOne({
    where: {
      id: id || null,
      userId: userId
    }
  });

  if (!id || !template) {
    // Create
    template = Template.build({
      id: uuid.v4(),
      userId
    });

    if (id) {
      template.copiedFromId = id;
    }
  }

  template.sdl = sdl;
  template.title = title;
  template.cpu = cpu;
  template.ram = ram;
  template.storage = storage;
  template.isPublic = isPublic;
  await template.save();

  return template.id;
}

export async function saveTemplateDesc(id: string, userId: string, description: string = "") {
  const template = await Template.findOne({
    where: {
      id: id,
      userId: userId
    }
  });

  if (!id || !template) {
    return;
  }

  template.description = description;

  await template.save();
}

export async function deleteTemplate(userId: string, id: string) {
  await Template.destroy({ where: { userId, id } });
}

export async function getFavoriteTemplates(userId: string) {
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

export async function addTemplateFavorite(userId: string, templateId: string) {
  const template = await TemplateFavorite.findOne({
    where: {
      templateId: templateId,
      userId: userId
    }
  });

  if (template) {
    return;
  }

  await TemplateFavorite.create({
    id: uuid.v4(),
    userId,
    templateId,
    addedDate: toUTC(new Date())
  });
}

export async function removeTemplateFavorite(userId: string, templateId: string) {
  await TemplateFavorite.destroy({ where: { userId: userId, templateId: templateId } });
}
