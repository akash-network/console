import { singleton } from "tsyringe";

import { Memoize } from "@src/caching/helpers";
import type { TemplateHardware } from "@src/template/types/template";
import { summarizeTemplateHardware } from "@src/template/utils/template-hardware/template-hardware";
import {
  CommunityTemplateRepository,
  type CommunityTemplateRow
} from "@src/template-marketplace/repositories/community-template/community-template.repository";
import {
  NO_TEMPLATE_USAGE,
  TemplateUsageEventRepository,
  type TemplateUsageSummary
} from "@src/template-marketplace/repositories/template-usage-event/template-usage-event.repository";

export type CommunityTemplateUsage = Pick<TemplateUsageSummary, "deploys" | "stillUpAfter24h" | "forks">;

/** Popular and trending scores are computed by a later job, and until then every template reads as not scored. */
export type TemplateScores = { popular: number | null; trending: number | null; isTrending: boolean };

export type CommunityTemplateCard = Pick<
  CommunityTemplateRow,
  "id" | "title" | "summary" | "icon" | "categories" | "isOfficial" | "isFeatured" | "versionCount" | "publishedAt" | "updatedAt"
> & {
  publisher: { name: string; handle: string; verified: boolean };
  resources: TemplateHardware | null;
  usage: CommunityTemplateUsage;
  scores: TemplateScores;
};

export type CommunityGallery = { templates: CommunityTemplateCard[]; officialUsage: Record<string, CommunityTemplateUsage> };

export const MAX_LISTED_COMMUNITY_TEMPLATES = 1000;

export const MAX_OFFICIAL_TEMPLATES_WITH_USAGE = 1000;

export const GALLERY_CACHE_SECONDS = 60;

const NOT_SCORED: TemplateScores = { popular: null, trending: null, isTrending: false };

function toCardUsage({ deploys, stillUpAfter24h, forks }: TemplateUsageSummary): CommunityTemplateUsage {
  return { deploys, stillUpAfter24h, forks };
}

function toCard({ sdlWithoutResources, publisher, ...row }: CommunityTemplateRow, usage: TemplateUsageSummary): CommunityTemplateCard {
  return {
    ...row,
    publisher: { name: publisher.name, handle: publisher.handle, verified: publisher.isVerified },
    resources: row.resources ?? ((sdlWithoutResources && summarizeTemplateHardware(sdlWithoutResources)) || null),
    usage: toCardUsage(usage),
    scores: NOT_SCORED
  };
}

@singleton()
export class CommunityTemplateService {
  constructor(
    private readonly communityTemplateRepository: CommunityTemplateRepository,
    private readonly templateUsageEventRepository: TemplateUsageEventRepository
  ) {}

  /** Holds nothing about the caller, so one answer serves everyone for a minute. */
  @Memoize({ ttlInSeconds: GALLERY_CACHE_SECONDS })
  async getGallery(): Promise<CommunityGallery> {
    const [templates, officialUsages] = await Promise.all([
      this.listCards(),
      this.templateUsageEventRepository.summarizeAwesomeAkash(MAX_OFFICIAL_TEMPLATES_WITH_USAGE)
    ]);

    return { templates, officialUsage: Object.fromEntries([...officialUsages].map(([id, usage]) => [id, toCardUsage(usage)])) };
  }

  async listCards(organizationId?: string): Promise<CommunityTemplateCard[]> {
    const rows = await this.communityTemplateRepository.list({ organizationId, limit: MAX_LISTED_COMMUNITY_TEMPLATES });
    const usages = await this.templateUsageEventRepository.summarize(rows.map(row => row.id));

    return rows.map(row => toCard(row, usages.get(row.id) ?? NO_TEMPLATE_USAGE));
  }
}
