import assert from "http-assert";
import { injectable } from "tsyringe";

import { TemplateGalleryService } from "@src/services/external/templates/template-gallery.service";
import { GetTemplatesListResponseSchema } from "@src/template/http-schemas/template.schema";
import { dataFolderPath } from "@src/utils/constants";
import { env } from "@src/utils/env";

@injectable()
export class TemplateController {
  private readonly templateGalleryService: TemplateGalleryService;

  constructor() {
    this.templateGalleryService = new TemplateGalleryService({
      githubPAT: env.GITHUB_PAT,
      dataFolderPath
    });
  }

  async getTemplatesFull() {
    return await this.templateGalleryService.getTemplateGallery();
  }

  async getTemplatesList() {
    const templatesPerCategory = await this.templateGalleryService.getTemplateGallery();
    // TODO: remove manual response filtering when https://github.com/honojs/middleware/issues/181 is done
    const arraySchema = GetTemplatesListResponseSchema.pick({ data: true }).shape.data;
    const filteredTemplatesPerCategory = await arraySchema.safeParseAsync(templatesPerCategory);
    const response = filteredTemplatesPerCategory.success ? filteredTemplatesPerCategory.data : templatesPerCategory;

    return { data: response };
  }

  async getTemplateById(id: string) {
    const template = await this.templateGalleryService.getTemplateById(id);
    assert(template, 404, "Template not found");

    return { data: template };
  }
}
