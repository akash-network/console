import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import MemoryCacheEngine from "@src/caching/memoryCacheEngine";
import type {
  CommunityTemplateRepository,
  CommunityTemplateRow
} from "@src/template-marketplace/repositories/community-template/community-template.repository";
import type {
  TemplateUsageEventRepository,
  TemplateUsageSummary
} from "@src/template-marketplace/repositories/template-usage-event/template-usage-event.repository";
import { CommunityTemplateService, MAX_LISTED_COMMUNITY_TEMPLATES, MAX_OFFICIAL_TEMPLATES_WITH_USAGE } from "./community-template.service";

const SDL = [
  "version: '2.0'",
  "services:",
  "  web:",
  "    image: nginx:1.27",
  "profiles:",
  "  compute:",
  "    web:",
  "      resources:",
  "        cpu:",
  "          units: 0.5",
  "        memory:",
  "          size: 512Mi",
  "        storage:",
  "          size: 1Gi",
  "deployment:",
  "  web:",
  "    dcloud:",
  "      profile: web",
  "      count: 2"
].join("\n");

describe(CommunityTemplateService.name, () => {
  describe("listCards", () => {
    it("describes each listed template as a card with its usage, not scored yet", async () => {
      const row = createRow({ publisher: { name: "Lambda Garage", handle: "lambda-garage", isVerified: true } });
      const usage: TemplateUsageSummary = { deploys: 1284, lastDeployedAt: faker.date.recent(), stillUpAfter24h: 0.94, forks: 37 };
      const { service, communityTemplateRepository, templateUsageEventRepository } = setup({ rows: [row], usages: new Map([[row.id, usage]]) });

      const cards = await service.listCards();

      expect(cards).toEqual([
        {
          id: row.id,
          title: row.title,
          summary: row.summary,
          icon: row.icon,
          categories: row.categories,
          isOfficial: row.isOfficial,
          isFeatured: row.isFeatured,
          publisher: { name: "Lambda Garage", handle: "lambda-garage", verified: true },
          resources: row.resources,
          versionCount: row.versionCount,
          publishedAt: row.publishedAt,
          updatedAt: row.updatedAt,
          usage: { deploys: 1284, stillUpAfter24h: 0.94, forks: 37 },
          scores: { popular: null, trending: null, isTrending: false }
        }
      ]);
      expect(communityTemplateRepository.list).toHaveBeenCalledWith({ organizationId: undefined, limit: MAX_LISTED_COMMUNITY_TEMPLATES });
      expect(templateUsageEventRepository.summarize).toHaveBeenCalledWith([row.id]);
    });

    it("shows a template nobody used with no usage, and keeps the order it was listed in", async () => {
      const [first, second] = [createRow(), createRow()];
      const { service } = setup({ rows: [first, second] });

      const cards = await service.listCards();

      expect(cards.map(card => card.id)).toEqual([first.id, second.id]);
      expect(cards.map(card => card.usage)).toEqual([
        { deploys: 0, stillUpAfter24h: null, forks: 0 },
        { deploys: 0, stillUpAfter24h: null, forks: 0 }
      ]);
    });

    it("reads the resources from the SDL of a version that recorded none, and shows none when the SDL cannot be read", async () => {
      const [fromSdl, unreadable] = [
        createRow({ resources: null, sdlWithoutResources: SDL }),
        createRow({ resources: null, sdlWithoutResources: "not: [an sdl" })
      ];
      const { service } = setup({ rows: [fromSdl, unreadable] });

      const cards = await service.listCards();

      expect(cards.map(card => card.resources)).toEqual([{ cpu: 1, memoryBytes: 1_073_741_824, storageBytes: 2_147_483_648 }, null]);
      expect(cards.every(card => !("sdlWithoutResources" in card))).toBe(true);
    });

    it("lists the templates of one publisher when asked", async () => {
      const organizationId = faker.string.uuid();
      const { service, communityTemplateRepository } = setup();

      await service.listCards(organizationId);

      expect(communityTemplateRepository.list).toHaveBeenCalledWith({ organizationId, limit: MAX_LISTED_COMMUNITY_TEMPLATES });
    });
  });

  describe("getGallery", () => {
    it("answers the listed templates with the usage of the awesome-akash templates by id", async () => {
      const row = createRow();
      const officialUsages = new Map<string, TemplateUsageSummary>([
        ["akash-network-awesome-akash-nginx", { deploys: 9, lastDeployedAt: faker.date.recent(), stillUpAfter24h: 0.5, forks: 0 }],
        ["constructor", { deploys: 1, lastDeployedAt: null, stillUpAfter24h: null, forks: 0 }]
      ]);
      const { service, templateUsageEventRepository } = setup({ rows: [row], officialUsages });

      const gallery = await service.getGallery();

      expect(gallery.templates.map(card => card.id)).toEqual([row.id]);
      expect(gallery.officialUsage).toEqual({
        "akash-network-awesome-akash-nginx": { deploys: 9, stillUpAfter24h: 0.5, forks: 0 },
        constructor: { deploys: 1, stillUpAfter24h: null, forks: 0 }
      });
      expect(Object.keys(gallery.officialUsage)).toEqual(["akash-network-awesome-akash-nginx", "constructor"]);
      expect(templateUsageEventRepository.summarizeAwesomeAkash).toHaveBeenCalledWith(MAX_OFFICIAL_TEMPLATES_WITH_USAGE);
    });

    it("answers every caller from one reading for a while", async () => {
      const { service, communityTemplateRepository, templateUsageEventRepository } = setup({ rows: [createRow()] });

      const [first, second] = [await service.getGallery(), await service.getGallery()];

      expect(second).toBe(first);
      expect(communityTemplateRepository.list).toHaveBeenCalledTimes(1);
      expect(templateUsageEventRepository.summarizeAwesomeAkash).toHaveBeenCalledTimes(1);
    });
  });

  function createRow(overrides: Partial<CommunityTemplateRow> = {}): CommunityTemplateRow {
    return {
      id: faker.string.uuid(),
      title: faker.lorem.words(3),
      summary: faker.lorem.sentence(),
      icon: "globe",
      categories: ["Web"],
      isOfficial: false,
      isFeatured: false,
      publishedAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      publisher: { name: faker.company.name(), handle: `publisher-${faker.string.alphanumeric(8).toLowerCase()}`, isVerified: false },
      resources: { cpu: 0.5, memoryBytes: 536_870_912, storageBytes: 1_073_741_824 },
      sdlWithoutResources: null,
      versionCount: faker.number.int({ min: 1, max: 9 }),
      ...overrides
    };
  }

  function setup(
    input: { rows?: CommunityTemplateRow[]; usages?: Map<string, TemplateUsageSummary>; officialUsages?: Map<string, TemplateUsageSummary> } = {}
  ) {
    MemoryCacheEngine.clearAllCaches();
    const communityTemplateRepository = mock<CommunityTemplateRepository>();
    communityTemplateRepository.list.mockResolvedValue(input.rows ?? []);
    const templateUsageEventRepository = mock<TemplateUsageEventRepository>();
    templateUsageEventRepository.summarize.mockResolvedValue(input.usages ?? new Map());
    templateUsageEventRepository.summarizeAwesomeAkash.mockResolvedValue(input.officialUsages ?? new Map());
    const service = new CommunityTemplateService(communityTemplateRepository, templateUsageEventRepository);

    return { service, communityTemplateRepository, templateUsageEventRepository };
  }
});
