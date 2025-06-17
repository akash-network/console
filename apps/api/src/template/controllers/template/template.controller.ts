import assert from "http-assert";
import { injectable } from "tsyringe";

import { GetTemplatesListResponseSchema } from "@src/template/http-schemas/template.schema";
import { TemplateGalleryService } from "@src/template/services/template-gallery/template-gallery.service";

@injectable()
export class TemplateController {
  constructor(private readonly templateGalleryService: TemplateGalleryService) {}

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
