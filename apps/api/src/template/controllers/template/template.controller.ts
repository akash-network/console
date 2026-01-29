import assert from "http-assert";
import { inject, singleton } from "tsyringe";

import { Template } from "@src/template/types/template";
import { TEMPLATE_GALLERY_SERVICE } from "../../providers/template-gallery.provider";
import { TemplateGalleryService } from "../../services/template-gallery/template-gallery.service";

@singleton()
export class TemplateController {
  constructor(@inject(TEMPLATE_GALLERY_SERVICE) private readonly templateGalleryService: TemplateGalleryService) {}

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
