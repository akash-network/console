import { promises as fsp } from "node:fs";
import type { InjectionToken } from "tsyringe";
import { container, instancePerContainerCachingFactory } from "tsyringe";

import { LoggerService } from "@src/core";
import { dataFolderPath } from "@src/utils/constants";
import { TemplateGalleryService } from "../services/template-gallery/template-gallery.service";
import { TEMPLATE_CONFIG } from "./config.provider";

export const TEMPLATE_GALLERY_SERVICE: InjectionToken<TemplateGalleryService> = Symbol("TEMPLATE_GALLERY_SERVICE");

container.register(TEMPLATE_GALLERY_SERVICE, {
  useFactory: instancePerContainerCachingFactory(c => {
    const config = c.resolve(TEMPLATE_CONFIG);
    const logger = c.resolve(LoggerService);
    logger.setContext(TemplateGalleryService.name);
    return new TemplateGalleryService(logger, fsp, {
      githubPAT: config.GITHUB_PAT,
      dataFolderPath
    });
  })
});
