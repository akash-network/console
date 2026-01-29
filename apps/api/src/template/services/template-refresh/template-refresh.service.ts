import type { Disposable } from "tsyringe";

import type { LoggerService } from "@src/core";
import type { AppInitializer } from "@src/core/providers/app-initializer";
import { ON_APP_START } from "@src/core/providers/app-initializer";
import { GetTemplatesListResponseSchema } from "@src/template/http-schemas/template.schema";
import type { TemplateConfig } from "../../config/env.config";
import type { TemplateGalleryService } from "../template-gallery/template-gallery.service";

const categoriesSchema = GetTemplatesListResponseSchema.shape.data;

export class TemplateRefreshService implements AppInitializer, Disposable {
  #timeout: ReturnType<typeof setTimeout> | null = null;
  #disposed = false;

  constructor(
    private readonly templateGalleryService: TemplateGalleryService,
    private readonly logger: LoggerService,
    private readonly config: TemplateConfig
  ) {}

  async [ON_APP_START](): Promise<void> {
    if (!this.config.TEMPLATE_REFRESH_ENABLED) {
      this.logger.info({ event: "TEMPLATE_REFRESH_DISABLED", message: "Template refresh disabled via TEMPLATE_REFRESH_ENABLED" });
      return;
    }

    if (!this.config.GITHUB_PAT) {
      this.logger.info({ event: "TEMPLATE_REFRESH_DISABLED", message: "GITHUB_PAT not configured, template refresh disabled" });
      return;
    }

    this.logger.info({
      event: "TEMPLATE_REFRESH_REGISTERED",
      message: `Template refresh scheduled every ${this.config.TEMPLATE_REFRESH_INTERVAL_SECONDS}s`
    });

    this.#scheduleNext();
  }

  dispose(): void {
    this.#disposed = true;
    if (this.#timeout) {
      clearTimeout(this.#timeout);
      this.#timeout = null;
    }
  }

  #scheduleNext(): void {
    if (this.#disposed) return;

    this.#timeout = setTimeout(async () => {
      try {
        this.logger.info({ event: "TEMPLATE_REFRESH_START" });
        await this.templateGalleryService.refreshCache(categoriesSchema);
        this.logger.info({ event: "TEMPLATE_REFRESH_COMPLETE" });
      } catch (error) {
        this.logger.error({ event: "TEMPLATE_REFRESH_ERROR", error });
      } finally {
        this.#scheduleNext();
      }
    }, this.config.TEMPLATE_REFRESH_INTERVAL_SECONDS * 1000);
  }
}
