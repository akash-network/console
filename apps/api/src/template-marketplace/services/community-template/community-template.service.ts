import { singleton } from "tsyringe";

import { Memoize } from "@src/caching/helpers";
import type { TemplateHardware } from "@src/template/types/template";
import { summarizeTemplateHardware } from "@src/template/utils/template-hardware/template-hardware";
import { InjectTemplateMarketplaceConfig, type TemplateMarketplaceConfig } from "@src/template-marketplace/providers/config.provider";
import {
  CommunityTemplateRepository,
  type CommunityTemplateRow
} from "@src/template-marketplace/repositories/community-template/community-template.repository";
import { type ServedTemplateScore, TemplateScoreRepository } from "@src/template-marketplace/repositories/template-score/template-score.repository";
import {
  NO_TEMPLATE_USAGE,
  TemplateUsageEventRepository,
  type TemplateUsageSummary
} from "@src/template-marketplace/repositories/template-usage-event/template-usage-event.repository";

export type CommunityTemplateUsage = Pick<TemplateUsageSummary, "deploys" | "stillUpAfter24h" | "forks">;

/** A template with no counted usage has no score yet, which sorts like a zero. */
export type TemplateScores = { popular: number | null; trending: number | null; isTrending: boolean };

export type CommunityTemplateCard = Pick<
  CommunityTemplateRow,
  "id" | "title" | "summary" | "icon" | "categories" | "isOfficial" | "isFeatured" | "importedRef" | "versionCount" | "publishedAt" | "updatedAt"
> & {
  publisher: { name: string; handle: string; verified: boolean };
  resources: TemplateHardware | null;
  usage: CommunityTemplateUsage;
  scores: TemplateScores;
};

export type OfficialTemplateUsage = CommunityTemplateUsage & { scores: TemplateScores };

export type CommunityGallery = {
  templates: CommunityTemplateCard[];
  officialUsage: Record<string, OfficialTemplateUsage>;
  trendingRowMinTemplates: number;
};

export const MAX_LISTED_COMMUNITY_TEMPLATES = 1000;

export const MAX_OFFICIAL_TEMPLATES_WITH_USAGE = 1000;

export const GALLERY_CACHE_SECONDS = 60;

const NOT_SCORED: TemplateScores = { popular: null, trending: null, isTrending: false };

function toCardUsage({ deploys, stillUpAfter24h, forks }: TemplateUsageSummary): CommunityTemplateUsage {
  return { deploys, stillUpAfter24h, forks };
}

function toScores(score: ServedTemplateScore | null | undefined): TemplateScores {
  return score ? { popular: score.popularScore, trending: score.trendingScore, isTrending: score.isTrending } : NOT_SCORED;
}

function toCard({ sdlWithoutResources, publisher, score, ...row }: CommunityTemplateRow, usage: TemplateUsageSummary): CommunityTemplateCard {
  return {
    ...row,
    publisher: { name: publisher.name, handle: publisher.handle, verified: publisher.isVerified },
    resources: row.resources ?? ((sdlWithoutResources && summarizeTemplateHardware(sdlWithoutResources)) || null),
    usage: toCardUsage(usage),
    scores: toScores(score)
  };
}

@singleton()
export class CommunityTemplateService {
  constructor(
    private readonly communityTemplateRepository: CommunityTemplateRepository,
    private readonly templateUsageEventRepository: TemplateUsageEventRepository,
    private readonly templateScoreRepository: TemplateScoreRepository,
    @InjectTemplateMarketplaceConfig() private readonly config: TemplateMarketplaceConfig
  ) {}

  /** Holds nothing about the caller, so one answer serves everyone for a minute. */
  @Memoize({ ttlInSeconds: GALLERY_CACHE_SECONDS })
  async getGallery(): Promise<CommunityGallery> {
    const [templates, officialUsages] = await Promise.all([
      this.listCards(),
      this.templateUsageEventRepository.summarizeAwesomeAkash(MAX_OFFICIAL_TEMPLATES_WITH_USAGE)
    ]);

    const officialScores = await this.templateScoreRepository.findByRefs("awesome_akash", [...officialUsages.keys()]);

    return {
      templates,
      officialUsage: Object.fromEntries([...officialUsages].map(([id, usage]) => [id, { ...toCardUsage(usage), scores: toScores(officialScores.get(id)) }])),
      trendingRowMinTemplates: this.config.TEMPLATE_TRENDING_ROW_MIN_TEMPLATES
    };
  }

  async listCards(organizationId?: string): Promise<CommunityTemplateCard[]> {
    const rows = await this.communityTemplateRepository.list({ organizationId, limit: MAX_LISTED_COMMUNITY_TEMPLATES });
    const usages = await this.templateUsageEventRepository.summarize(rows.map(row => row.id));

    return rows.map(row => toCard(row, usages.get(row.id) ?? NO_TEMPLATE_USAGE));
  }
}
