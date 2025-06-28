import "reflect-metadata";

import { container } from "tsyringe";

import { TemplateGalleryService } from "@src/template/services/template-gallery/template-gallery.service";

export async function getTemplateGallery() {
  const templateGalleryService = container.resolve(TemplateGalleryService);
  return await templateGalleryService.getTemplateGallery();
}
