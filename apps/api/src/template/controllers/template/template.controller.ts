import assert from "http-assert";
import { promises as fsp } from "node:fs";
import { inject, singleton } from "tsyringe";

import { LoggerService } from "@src/core";
import { TEMPLATE_CONFIG, type TemplateConfig } from "@src/template/providers/config.provider";
import { Template } from "@src/template/types/template";
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

  async getTemplatesList(): Promise<string> {
    const { categories } = await this.templateGalleryService.getCachedTemplateGallery();
    return `{"data":${categories}}`;
  }

  async getTemplateById(id: string): Promise<{ data: Template }> {
    const template = await this.templateGalleryService.getTemplateById(id);
    assert(template, 404, "Template not found");

    return { data: template };
  }
}
