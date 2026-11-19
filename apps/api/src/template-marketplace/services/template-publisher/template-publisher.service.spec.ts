import { createMongoAbility, type MongoAbility, type RawRuleOf } from "@casl/ability";
import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import MemoryCacheEngine from "@src/caching/memoryCacheEngine";
import type { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type {
  TemplatePublisherProfile,
  TemplatePublisherRepository
} from "@src/template-marketplace/repositories/template-publisher/template-publisher.repository";
import type { CommunityTemplateCard, CommunityTemplateService } from "@src/template-marketplace/services/community-template/community-template.service";
import { TemplatePublisherService } from "./template-publisher.service";

import { createOrganizationContext } from "@test/seeders/organization-context.seeder";

describe(TemplatePublisherService.name, () => {
  describe("getPage", () => {
    it("describes the publisher with the templates it lists and what they add up to", async () => {
      const profile = createProfile({ bio: "We build GPU stacks.", links: [{ url: "https://lambdagarage.dev/", label: "Site" }], isVerified: true });
      const templates = [createCard({ deploys: 12 }), createCard({ deploys: 30 }), createCard({ deploys: 0 })];
      const { service, templatePublisherRepository, communityTemplateService } = setup({ profile, templates });

      const page = await service.getPage(profile.handle);

      expect(page).toEqual({
        name: profile.name,
        handle: profile.handle,
        type: profile.type,
        bio: "We build GPU stacks.",
        links: [{ url: "https://lambdagarage.dev/", label: "Site" }],
        verified: true,
        memberSince: profile.memberSince,
        counts: { templates: 3, deploys: 42 },
        templates
      });
      expect(templatePublisherRepository.findProfileByHandle).toHaveBeenCalledWith(profile.handle);
      expect(communityTemplateService.listCards).toHaveBeenCalledWith(profile.organizationId);
    });

    it("counts nothing for a publisher that lists no template", async () => {
      const profile = createProfile();
      const { service } = setup({ profile, templates: [] });

      expect(await service.getPage(profile.handle)).toMatchObject({ counts: { templates: 0, deploys: 0 }, templates: [] });
    });

    it.each<[string, TemplatePublisherProfile | undefined]>([
      ["an unknown handle", undefined],
      ["a publisher whose publishing is suspended", createProfile({ isSuspended: true })]
    ])("answers 404 for %s, without reading any template", async (_case, profile) => {
      const { service, communityTemplateService } = setup({ profile });

      await expect(service.getPage("lambda-garage")).rejects.toMatchObject({ status: 404, message: "Publisher not found" });
      expect(communityTemplateService.listCards).not.toHaveBeenCalled();
    });

    it("answers every caller from one reading per publisher for a while, and never keeps a refusal", async () => {
      const profile = createProfile();
      const { service, templatePublisherRepository } = setup({ profile });
      templatePublisherRepository.findProfileByHandle.mockResolvedValueOnce(undefined);

      await expect(service.getPage(profile.handle)).rejects.toMatchObject({ status: 404 });
      const [first, second] = [await service.getPage(profile.handle), await service.getPage(profile.handle)];
      await service.getPage("another-publisher");

      expect(second).toBe(first);
      expect(templatePublisherRepository.findProfileByHandle.mock.calls).toEqual([[profile.handle], [profile.handle], ["another-publisher"]]);
    });
  });

  describe("getCurrent", () => {
    it.each<[string, RawRuleOf<MongoAbility>[], boolean]>([
      ["who may change the organization", [{ action: "update", subject: "Organization" }], true],
      ["who may only read the organization", [{ action: "read", subject: "Organization" }], false]
    ])("describes the active organization's publisher to a member %s", async (_case, rules, canEdit) => {
      const profile = createProfile({ bio: "Hello" });
      const { service, templatePublisherRepository } = setup({ profile, rules, activeOrganizationId: profile.organizationId });

      const current = await service.getCurrent();

      expect(current).toEqual({
        name: profile.name,
        handle: profile.handle,
        type: profile.type,
        bio: "Hello",
        links: [],
        verified: false,
        memberSince: profile.memberSince,
        canEdit
      });
      expect(templatePublisherRepository.findProfileOfOrganization).toHaveBeenCalledWith(profile.organizationId);
    });

    it("lets an owner of another organization change nothing here", async () => {
      const profile = createProfile();
      const { service } = setup({
        profile,
        rules: [{ action: "update", subject: "Organization", conditions: { id: faker.string.uuid() } }],
        activeOrganizationId: profile.organizationId
      });

      expect((await service.getCurrent()).canEdit).toBe(false);
    });

    it("answers 404 for an organization that has not published yet", async () => {
      const { service } = setup({ profile: undefined });

      await expect(service.getCurrent()).rejects.toMatchObject({ status: 404, message: "This organization has not published a template yet" });
    });

    it("answers 404 without looking anything up when no organization is active", async () => {
      const { service, templatePublisherRepository } = setup({ activeOrganizationId: null });

      await expect(service.getCurrent()).rejects.toMatchObject({ status: 404 });
      expect(templatePublisherRepository.findProfileOfOrganization).not.toHaveBeenCalled();
    });
  });

  describe("updateCurrent", () => {
    it("stores the bio and the links given and answers the profile as stored", async () => {
      const profile = createProfile();
      const stored = { ...profile, bio: "New bio", links: [{ url: "https://lambdagarage.dev/", label: null }] };
      const { service, templatePublisherRepository } = setup({ profile, activeOrganizationId: profile.organizationId });
      templatePublisherRepository.findProfileOfOrganization.mockResolvedValueOnce(profile).mockResolvedValueOnce(stored);

      const result = await service.updateCurrent({
        bio: "New bio",
        links: [{ url: "https://lambdagarage.dev/" }, { url: "https://github.com/lambda", label: "GitHub" }, { url: "https://x.com/lambda", label: null }]
      });

      expect(templatePublisherRepository.updateProfile).toHaveBeenCalledWith(profile.organizationId, {
        bio: "New bio",
        links: [
          { url: "https://lambdagarage.dev/", label: null },
          { url: "https://github.com/lambda", label: "GitHub" },
          { url: "https://x.com/lambda", label: null }
        ]
      });
      expect(result).toMatchObject({ bio: "New bio", links: stored.links, canEdit: true });
    });

    it.each<[string, { bio?: string | null; links?: { url: string }[] }, object]>([
      ["clears a bio sent blank", { bio: "" }, { bio: null }],
      ["clears a bio sent null", { bio: null }, { bio: null }],
      ["leaves the bio alone when only links are sent", { links: [] }, { links: [] }],
      ["leaves the links alone when only a bio is sent", { bio: "Kept short" }, { bio: "Kept short" }]
    ])("%s", async (_case, patch, update) => {
      const profile = createProfile();
      const { service, templatePublisherRepository } = setup({ profile, activeOrganizationId: profile.organizationId });

      await service.updateCurrent(patch);

      expect(templatePublisherRepository.updateProfile).toHaveBeenCalledWith(profile.organizationId, update);
    });

    it.each<[string, RawRuleOf<MongoAbility>[], string | null]>([
      ["a member who may not change the organization", [{ action: "read", subject: "Organization" }], faker.string.uuid()],
      ["a caller with no active organization", [{ action: "update", subject: "Organization" }], null]
    ])("refuses %s with 403 and stores nothing", async (_case, rules, activeOrganizationId) => {
      const { service, templatePublisherRepository } = setup({ rules, activeOrganizationId });

      await expect(service.updateCurrent({ bio: "Hello" })).rejects.toMatchObject({
        status: 403,
        message: "Only an owner or an admin of the organization can change its publisher profile"
      });
      expect(templatePublisherRepository.findProfileOfOrganization).not.toHaveBeenCalled();
      expect(templatePublisherRepository.updateProfile).not.toHaveBeenCalled();
    });

    it("answers 404 and stores nothing for an organization that has not published yet", async () => {
      const { service, templatePublisherRepository } = setup({ profile: undefined });

      await expect(service.updateCurrent({ bio: "Hello" })).rejects.toMatchObject({
        status: 404,
        message: "This organization has not published a template yet"
      });
      expect(templatePublisherRepository.updateProfile).not.toHaveBeenCalled();
    });
  });

  function createProfile(overrides: Partial<TemplatePublisherProfile> = {}): TemplatePublisherProfile {
    return {
      organizationId: faker.string.uuid(),
      name: faker.company.name(),
      type: "team",
      handle: `publisher-${faker.string.alphanumeric(8).toLowerCase()}`,
      bio: null,
      links: [],
      isVerified: false,
      isSuspended: false,
      memberSince: faker.date.past(),
      ...overrides
    };
  }

  function createCard({ deploys }: { deploys: number }) {
    return mock<CommunityTemplateCard>({ id: faker.string.uuid(), usage: { deploys, stillUpAfter24h: null, forks: 0 } });
  }

  function setup(
    input: {
      profile?: TemplatePublisherProfile;
      templates?: CommunityTemplateCard[];
      rules?: RawRuleOf<MongoAbility>[];
      activeOrganizationId?: string | null;
    } = {}
  ) {
    MemoryCacheEngine.clearAllCaches();
    const profile = "profile" in input ? input.profile : createProfile();
    const templatePublisherRepository = mock<TemplatePublisherRepository>();
    templatePublisherRepository.findProfileByHandle.mockResolvedValue(profile);
    templatePublisherRepository.findProfileOfOrganization.mockResolvedValue(profile);
    const communityTemplateService = mock<CommunityTemplateService>();
    communityTemplateService.listCards.mockResolvedValue(input.templates ?? []);
    const authService = mock<AuthService>();
    authService.ability = createMongoAbility<MongoAbility>(input.rules ?? [{ action: "update", subject: "Organization" }]);
    const activeOrganizationId = input.activeOrganizationId === undefined ? faker.string.uuid() : input.activeOrganizationId;
    const executionContextService = mock<ExecutionContextService>();
    executionContextService.get
      .calledWith("ORGANIZATION_CONTEXT")
      .mockReturnValue(activeOrganizationId ? createOrganizationContext({ organizationId: activeOrganizationId }) : undefined);
    const service = new TemplatePublisherService(templatePublisherRepository, communityTemplateService, authService, executionContextService);

    return { service, templatePublisherRepository, communityTemplateService };
  }
});
