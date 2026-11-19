import { subject } from "@casl/ability";
import assert from "http-assert";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { Memoize } from "@src/caching/helpers";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { PublisherCounts } from "@src/template-marketplace/repositories/community-template/community-template.repository";
import {
  type TemplatePublisherProfile,
  type TemplatePublisherProfileUpdate,
  TemplatePublisherRepository
} from "@src/template-marketplace/repositories/template-publisher/template-publisher.repository";
import { type CommunityTemplateCard, CommunityTemplateService } from "@src/template-marketplace/services/community-template/community-template.service";

export type PublicPublisherProfile = Pick<TemplatePublisherProfile, "name" | "handle" | "type" | "bio" | "links" | "memberSince"> & { verified: boolean };

export type TemplatePublisherPage = PublicPublisherProfile & { counts: PublisherCounts; templates: CommunityTemplateCard[] };

export type CurrentTemplatePublisher = PublicPublisherProfile & { canEdit: boolean };

export type PublisherProfilePatch = { bio?: string | null; links?: { url: string; label?: string | null }[] };

export const PUBLISHER_PAGE_CACHE_SECONDS = 60;

const MAX_CACHED_PUBLISHER_PAGES = 500;

const PUBLISHER_NOT_FOUND = "Publisher not found";

const NOT_A_PUBLISHER_YET = "This organization has not published a template yet";

function toPublicProfile({ name, handle, type, bio, links, isVerified, memberSince }: TemplatePublisherProfile): PublicPublisherProfile {
  return { name, handle, type, bio, links, verified: isVerified, memberSince };
}

function toProfileUpdate({ bio, links }: PublisherProfilePatch): TemplatePublisherProfileUpdate {
  return {
    ...(bio !== undefined && { bio: bio || null }),
    ...(links && { links: links.map(({ url, label }) => ({ url, label: label ?? null })) })
  };
}

@singleton()
export class TemplatePublisherService {
  constructor(
    private readonly templatePublisherRepository: TemplatePublisherRepository,
    private readonly communityTemplateService: CommunityTemplateService,
    private readonly authService: AuthService,
    private readonly executionContextService: ExecutionContextService
  ) {}

  /** Holds nothing about the caller, so one answer per publisher serves everyone for a minute; a suspended publisher reads as unknown. */
  @Memoize({ ttlInSeconds: PUBLISHER_PAGE_CACHE_SECONDS, maxEntries: MAX_CACHED_PUBLISHER_PAGES })
  async getPage(handle: string): Promise<TemplatePublisherPage> {
    const profile = await this.templatePublisherRepository.findProfileByHandle(handle);
    assert(profile && !profile.isSuspended, 404, PUBLISHER_NOT_FOUND);
    const templates = await this.communityTemplateService.listCards(profile.organizationId);

    return {
      ...toPublicProfile(profile),
      counts: { templates: templates.length, deploys: templates.reduce((deploys, template) => deploys + template.usage.deploys, 0) },
      templates
    };
  }

  async getCurrent(): Promise<CurrentTemplatePublisher> {
    const organizationId = this.#activeOrganizationId;
    const profile = organizationId && (await this.templatePublisherRepository.findProfileOfOrganization(organizationId));
    assert(profile, 404, NOT_A_PUBLISHER_YET);

    return { ...toPublicProfile(profile), canEdit: this.#canEditProfileOf(profile.organizationId) };
  }

  async updateCurrent(patch: PublisherProfilePatch): Promise<CurrentTemplatePublisher> {
    const organizationId = this.#activeOrganizationId;
    assert(organizationId && this.#canEditProfileOf(organizationId), 403, "Only an owner or an admin of the organization can change its publisher profile");
    assert(await this.templatePublisherRepository.findProfileOfOrganization(organizationId), 404, NOT_A_PUBLISHER_YET);
    await this.templatePublisherRepository.updateProfile(organizationId, toProfileUpdate(patch));

    return await this.getCurrent();
  }

  get #activeOrganizationId(): string | undefined {
    return this.executionContextService.get("ORGANIZATION_CONTEXT")?.organizationId;
  }

  /** The profile speaks for the whole organization, so it follows the right to change the organization itself. */
  #canEditProfileOf(organizationId: string): boolean {
    return this.authService.ability.can("update", subject("Organization", { id: organizationId }));
  }
}
