import assert from "http-assert";
import { promises as fsp } from "node:fs";
import { inject, singleton } from "tsyringe";

import { LoggerService } from "@src/core";
import { GetTemplatesListResponseSchema } from "@src/template/http-schemas/template.schema";
import { TEMPLATE_CONFIG, type TemplateConfig } from "@src/template/providers/config.provider";
import { dataFolderPath } from "@src/utils/constants";
import { TemplateGalleryService } from "../../services/template-gallery/template-gallery.service";

@singleton()
export class TemplateController {
  private readonly templateGalleryService: TemplateGalleryService;

  constructor(@inject(TEMPLATE_CONFIG) templateConfig: TemplateConfig, logger: LoggerService) {
    logger.setContext(TemplateGalleryService.name);
    this.templateGalleryService = new TemplateGalleryService(logger, fsp, {
      githubPAT: templateConfig.GITHUB_PAT,
      dataFolderPath
    });
  }

  async getTemplatesFull() {
    const result = await this.templateGalleryService.getTemplateGallery();
    return result.categories;
  }

  async getTemplatesList() {
    const templatesPerCategory = await this.templateGalleryService.getTemplateGallery();
    // TODO: remove manual response filtering when https://github.com/honojs/middleware/issues/181 is done
    const arraySchema = GetTemplatesListResponseSchema.pick({ data: true }).shape.data;
    const filteredTemplatesPerCategory = await arraySchema.safeParseAsync(templatesPerCategory.categories);
    const response = filteredTemplatesPerCategory.success ? filteredTemplatesPerCategory.data : templatesPerCategory.categories;

    return { data: response };
  }

  async getTemplateById(id: string) {
    const template = await this.templateGalleryService.getTemplateById(id);
    assert(template, 404, "Template not found");

    return { data: template };
  }
}
