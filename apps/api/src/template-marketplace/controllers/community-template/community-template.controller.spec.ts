import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CommunityTemplateCard, CommunityTemplateService } from "@src/template-marketplace/services/community-template/community-template.service";
import type {
  CurrentTemplatePublisher,
  TemplatePublisherPage,
  TemplatePublisherService
} from "@src/template-marketplace/services/template-publisher/template-publisher.service";
import { CommunityTemplateController } from "./community-template.controller";

describe(CommunityTemplateController.name, () => {
  describe("listTemplates", () => {
    it("answers the gallery with its dates as text", async () => {
      const card = createCard();
      const officialUsage = { nginx: { deploys: 3, stillUpAfter24h: null, forks: 0 } };
      const { controller, communityTemplateService } = setup();
      communityTemplateService.getGallery.mockResolvedValue({ templates: [card], officialUsage });

      const result = await controller.listTemplates();

      expect(result).toEqual({
        data: {
          templates: [{ ...card, publishedAt: card.publishedAt.toISOString(), updatedAt: card.updatedAt.toISOString() }],
          officialUsage
        }
      });
    });
  });

  describe("getPublisher", () => {
    it("answers the publisher page with its dates as text", async () => {
      const card = createCard();
      const page: TemplatePublisherPage = {
        name: "Lambda Garage",
        handle: "lambda-garage",
        type: "team",
        bio: "We build GPU stacks.",
        links: [{ url: "https://lambdagarage.dev/", label: null }],
        verified: true,
        memberSince: faker.date.past(),
        counts: { templates: 1, deploys: card.usage.deploys },
        templates: [card]
      };
      const { controller, templatePublisherService } = setup();
      templatePublisherService.getPage.mockResolvedValue(page);

      const result = await controller.getPublisher("lambda-garage");

      expect(templatePublisherService.getPage).toHaveBeenCalledWith("lambda-garage");
      expect(result).toEqual({
        data: {
          ...page,
          memberSince: page.memberSince.toISOString(),
          templates: [{ ...card, publishedAt: card.publishedAt.toISOString(), updatedAt: card.updatedAt.toISOString() }]
        }
      });
    });
  });

  describe("getCurrentPublisher", () => {
    it("answers the active organization's publisher", async () => {
      const publisher = createCurrentPublisher();
      const { controller, templatePublisherService } = setup();
      templatePublisherService.getCurrent.mockResolvedValue(publisher);

      expect(await controller.getCurrentPublisher()).toEqual({ data: { ...publisher, memberSince: publisher.memberSince.toISOString() } });
    });
  });

  describe("updateCurrentPublisher", () => {
    it("hands the change over and answers the profile as stored", async () => {
      const publisher = createCurrentPublisher();
      const change = { bio: "New bio", links: [{ url: "https://lambdagarage.dev/", label: null }] };
      const { controller, templatePublisherService } = setup();
      templatePublisherService.updateCurrent.mockResolvedValue(publisher);

      const result = await controller.updateCurrentPublisher({ data: change });

      expect(templatePublisherService.updateCurrent).toHaveBeenCalledWith(change);
      expect(result).toEqual({ data: { ...publisher, memberSince: publisher.memberSince.toISOString() } });
    });
  });

  function createCard(): CommunityTemplateCard {
    return {
      id: faker.string.uuid(),
      title: faker.lorem.words(3),
      summary: null,
      icon: null,
      categories: [],
      isOfficial: false,
      isFeatured: false,
      publisher: { name: "Lambda Garage", handle: "lambda-garage", verified: false },
      resources: null,
      versionCount: 1,
      publishedAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      usage: { deploys: faker.number.int({ min: 1, max: 100 }), stillUpAfter24h: 0.9, forks: 2 },
      scores: { popular: null, trending: null, isTrending: false }
    };
  }

  function createCurrentPublisher(): CurrentTemplatePublisher {
    return {
      name: "Lambda Garage",
      handle: "lambda-garage",
      type: "team",
      bio: null,
      links: [],
      verified: false,
      memberSince: faker.date.past(),
      canEdit: true
    };
  }

  function setup() {
    const communityTemplateService = mock<CommunityTemplateService>();
    const templatePublisherService = mock<TemplatePublisherService>();
    const controller = new CommunityTemplateController(communityTemplateService, templatePublisherService);

    return { controller, communityTemplateService, templatePublisherService };
  }
});
