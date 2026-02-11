import { promises as fsp } from "node:fs";
import type { InjectionToken } from "tsyringe";
import { container, instancePerContainerCachingFactory } from "tsyringe";

import { LoggerService } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { dataFolderPath } from "@src/utils/constants";
import {
  DEFAULT_CATEGORY_PRIORITY,
  DEFAULT_MOST_POPULAR_TEMPLATE_IDS,
  DEFAULT_RECOMMENDED_TEMPLATE_IDS,
  TemplateGalleryService,
  type TemplateTagsConfig
} from "../services/template-gallery/template-gallery.service";
import { TEMPLATE_CONFIG } from "./config.provider";

export const TEMPLATE_GALLERY_SERVICE: InjectionToken<TemplateGalleryService> = Symbol("TEMPLATE_GALLERY_SERVICE");

function getTagsConfigFromFlags(featureFlags: FeatureFlagsService): TemplateTagsConfig {
  const recommendedVariant = featureFlags.getVariant(FeatureFlags.TEMPLATE_RECOMMENDED_IDS);
  const popularVariant = featureFlags.getVariant(FeatureFlags.TEMPLATE_POPULAR_IDS);
  const priorityVariant = featureFlags.getVariant(FeatureFlags.TEMPLATE_CATEGORY_PRIORITY);

  return {
    recommendedIds:
      recommendedVariant?.payload?.type === "json" ? new Set(JSON.parse(recommendedVariant.payload.value) as string[]) : DEFAULT_RECOMMENDED_TEMPLATE_IDS,
    popularIds: popularVariant?.payload?.type === "json" ? new Set(JSON.parse(popularVariant.payload.value) as string[]) : DEFAULT_MOST_POPULAR_TEMPLATE_IDS,
    categoryPriority:
      priorityVariant?.payload?.type === "json" ? (JSON.parse(priorityVariant.payload.value) as Record<string, number>) : DEFAULT_CATEGORY_PRIORITY
  };
}

container.register(TEMPLATE_GALLERY_SERVICE, {
  useFactory: instancePerContainerCachingFactory(c => {
    const config = c.resolve(TEMPLATE_CONFIG);
    const logger = c.resolve(LoggerService);
    const featureFlags = c.resolve(FeatureFlagsService);
    logger.setContext(TemplateGalleryService.name);
    return new TemplateGalleryService(logger, fsp, {
      githubPAT: config.GITHUB_PAT,
      dataFolderPath,
      getTagsConfig: () => getTagsConfigFromFlags(featureFlags)
    });
  })
});
