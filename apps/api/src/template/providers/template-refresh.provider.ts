import { container, instancePerContainerCachingFactory } from "tsyringe";

import { LoggerService } from "@src/core";
import { DisposableRegistry } from "@src/core/lib/disposable-registry/disposable-registry";
import { APP_INITIALIZER } from "@src/core/providers/app-initializer";
import { TemplateRefreshService } from "../services/template-refresh/template-refresh.service";
import { TEMPLATE_CONFIG } from "./config.provider";
import { TEMPLATE_GALLERY_SERVICE } from "./template-gallery.provider";

container.register(APP_INITIALIZER, {
  useFactory: instancePerContainerCachingFactory(
    DisposableRegistry.registerFromFactory(c => {
      const templateGalleryService = c.resolve(TEMPLATE_GALLERY_SERVICE);
      const logger = c.resolve(LoggerService);
      logger.setContext(TemplateRefreshService.name);
      const config = c.resolve(TEMPLATE_CONFIG);
      return new TemplateRefreshService(templateGalleryService, logger, config);
    })
  )
});
