import { millisecondsInMinute } from "date-fns";
import createError from "http-errors";
import { LRUCache } from "lru-cache";
import { inject, singleton } from "tsyringe";
import { z } from "zod";

import type { ApiKeyOutput } from "@src/auth/repositories/api-key/api-key.repository";
import { cacheRegistry, nominalEntrySizing } from "@src/caching/cache-registry";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { ORGANIZATION_FORBIDDEN_ERROR_CODE } from "@src/core/repositories/org-scoped.repository";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import { type Membership, OrganizationMemberRepository } from "@src/organization/repositories/organization-member/organization-member.repository";
import { ProjectRepository } from "@src/organization/repositories/project/project.repository";
import { PersonalOrganizationService } from "@src/organization/services/personal-organization/personal-organization.service";
import type { AuthorizationMode, OrganizationContext, ProjectScope } from "@src/organization/types/organization-context";
import type { UserOutput } from "@src/user/repositories/user/user.repository";
import { UserRepository } from "@src/user/repositories/user/user.repository";

export const ORGANIZATION_ID_HEADER = "x-organization-id";
export const PROJECT_ID_HEADER = "x-project-id";

export const ORGANIZATION_MISMATCH_ERROR_CODE = "organization_mismatch";
export const PROJECT_FORBIDDEN_ERROR_CODE = "project_forbidden";

export const LAST_USED_ORGANIZATION_THROTTLE_MS = millisecondsInMinute;
const MAX_TRACKED_USERS = 1e5;
const LAST_USED_ORGANIZATION_ENTRY_BYTES = 128;
const PERSONAL_MEMBERSHIP_ENTRY_BYTES = 512;

const uuidSchema = z.string().uuid();

function isUuid(value: string) {
  return uuidSchema.safeParse(value).success;
}

function normalizeHeader(value: string | undefined) {
  return value?.trim().toLowerCase() || undefined;
}

export interface OrganizationContextRequest {
  user: Pick<UserOutput, "id" | "username" | "lastUsedOrganizationId">;
  apiKey?: Pick<ApiKeyOutput, "organizationId" | "projectId">;
  organizationHeader?: string;
  projectHeader?: string;
}

const PROJECT_SCOPE_BY_ROLE: Record<OrganizationRole, "all" | "grants" | "none"> = {
  owner: "all",
  admin: "all",
  member: "grants",
  viewer: "grants",
  billing: "none"
};

@singleton()
export class OrganizationContextResolver {
  readonly #logger: ReturnType<CreateLogger>;
  readonly #lastUsedOrganizationWrittenAt = new LRUCache<string, number>({
    max: MAX_TRACKED_USERS,
    ttl: LAST_USED_ORGANIZATION_THROTTLE_MS,
    ...nominalEntrySizing(MAX_TRACKED_USERS, LAST_USED_ORGANIZATION_ENTRY_BYTES)
  });
  /** A personal membership never changes: its single owner cannot leave it and it cannot be deleted. */
  readonly #personalMemberships = new LRUCache<string, Membership>({
    max: MAX_TRACKED_USERS,
    ...nominalEntrySizing(MAX_TRACKED_USERS, PERSONAL_MEMBERSHIP_ENTRY_BYTES)
  });

  constructor(
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly organizationMemberRepository: OrganizationMemberRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly personalOrganizationService: PersonalOrganizationService,
    private readonly userRepository: UserRepository,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: OrganizationContextResolver.name });
    cacheRegistry.register("OrganizationContextResolver#lastUsedOrganizationWrittenAt", this.#lastUsedOrganizationWrittenAt);
    cacheRegistry.register("OrganizationContextResolver#personalMemberships", this.#personalMemberships);
  }

  async resolve(request: OrganizationContextRequest): Promise<OrganizationContext | undefined> {
    const isOrganizationsOn = this.featureFlagsService.isEnabled(FeatureFlags.ORGANIZATIONS, { userId: request.user.id });
    const mode: AuthorizationMode =
      isOrganizationsOn || this.featureFlagsService.isEnabled(FeatureFlags.ORGANIZATIONS_ENFORCE, { userId: request.user.id }) ? "organization" : "legacy";

    if (!isOrganizationsOn) {
      return await this.#resolvePersonalContext(request, mode);
    }

    const { role, organization } = await this.#resolveMembership(request.user, request.apiKey, normalizeHeader(request.organizationHeader));
    const roleScope = await this.#projectScopeOf(role, organization.id, request.user.id);
    const keyScope = request.apiKey?.projectId ? narrowTo(roleScope, request.apiKey.projectId) : roleScope;
    const projectHeader = normalizeHeader(request.projectHeader);
    const projectScope = projectHeader ? await this.#narrowToRequestedProject(keyScope, organization.id, projectHeader) : keyScope;

    return { organizationId: organization.id, organizationType: organization.type, role, projectScope, mode };
  }

  async #resolvePersonalContext({ user, apiKey }: OrganizationContextRequest, mode: AuthorizationMode): Promise<OrganizationContext | undefined> {
    const membership = await this.#personalMembershipUnlessUnavailable(user, mode, apiKey);

    if (!membership) return undefined;

    const { organization } = membership;

    if (apiKey?.organizationId && apiKey.organizationId !== organization.id) {
      throw createError(403, "The API key belongs to an organization this request cannot run in", { errorCode: ORGANIZATION_FORBIDDEN_ERROR_CODE });
    }

    if (apiKey?.projectId && mode === "legacy") {
      throw createError(403, "The API key is limited to a project this request cannot be limited to", { errorCode: PROJECT_FORBIDDEN_ERROR_CODE });
    }

    const projectScope: ProjectScope = apiKey?.projectId ? { kind: "projects", projectIds: [apiKey.projectId] } : { kind: "all" };

    return { organizationId: organization.id, organizationType: organization.type, role: "owner", projectScope, mode };
  }

  async #personalMembershipUnlessUnavailable(
    user: OrganizationContextRequest["user"],
    mode: AuthorizationMode,
    apiKey: OrganizationContextRequest["apiKey"]
  ): Promise<Membership | undefined> {
    try {
      return await this.#personalMembership(user);
    } catch (error) {
      if (mode === "organization" || apiKey?.organizationId || apiKey?.projectId) throw error;

      this.#logger.error({ event: "PERSONAL_ORGANIZATION_CONTEXT_UNAVAILABLE", userId: user.id, error });
      return undefined;
    }
  }

  async #resolveMembership(
    user: OrganizationContextRequest["user"],
    apiKey: OrganizationContextRequest["apiKey"],
    organizationHeader: string | undefined
  ): Promise<Membership> {
    if (apiKey) {
      const membership = apiKey.organizationId
        ? await this.organizationMemberRepository.findActiveMembership(user.id, { id: apiKey.organizationId })
        : await this.#personalMembership(user);
      assertMember(membership);

      if (organizationHeader && organizationHeader !== membership.organization.id && organizationHeader !== membership.organization.slug) {
        throw createError(400, "The organization header names another organization than the API key's", { errorCode: ORGANIZATION_MISMATCH_ERROR_CODE });
      }

      return membership;
    }

    if (organizationHeader) {
      const lookup = isUuid(organizationHeader) ? { idOrSlug: organizationHeader } : { slug: organizationHeader };
      const membership = await this.organizationMemberRepository.findActiveMembership(user.id, lookup);
      assertMember(membership);
      this.#rememberLastUsedOrganization(user, membership.organization.id);

      return membership;
    }

    if (user.lastUsedOrganizationId) {
      const lastUsedMembership = await this.organizationMemberRepository.findActiveMembership(user.id, { id: user.lastUsedOrganizationId });

      if (lastUsedMembership) return lastUsedMembership;

      this.#forgetLastUsedOrganization(user.id, user.lastUsedOrganizationId);
    }

    return await this.#personalMembership(user);
  }

  async #personalMembership(user: OrganizationContextRequest["user"]): Promise<Membership> {
    const cached = this.#personalMemberships.get(user.id);

    if (cached) return cached;

    const membership = (await this.organizationMemberRepository.findActiveMembership(user.id, { type: "personal" })) ?? {
      role: "owner",
      organization: await this.personalOrganizationService.ensureForUser(user)
    };
    this.#personalMemberships.set(user.id, membership);

    return membership;
  }

  async #projectScopeOf(role: OrganizationRole, organizationId: string, userId: string): Promise<ProjectScope> {
    const scope = PROJECT_SCOPE_BY_ROLE[role];

    if (scope === "all") return { kind: "all" };
    if (scope === "none") return { kind: "projects", projectIds: [] };

    return { kind: "projects", projectIds: await this.projectRepository.findActiveIdsGrantedTo(organizationId, userId) };
  }

  async #narrowToRequestedProject(scope: ProjectScope, organizationId: string, projectId: string): Promise<ProjectScope> {
    if (!(await this.#isReachable(scope, organizationId, projectId))) {
      throw createError(403, "The project is not reachable in this organization", { errorCode: PROJECT_FORBIDDEN_ERROR_CODE });
    }

    return { kind: "projects", projectIds: [projectId] };
  }

  async #isReachable(scope: ProjectScope, organizationId: string, projectId: string): Promise<boolean> {
    if (!isUuid(projectId)) return false;
    if (scope.kind === "projects") return scope.projectIds.includes(projectId);

    return !!(await this.projectRepository.findActive(organizationId, projectId));
  }

  #rememberLastUsedOrganization(user: OrganizationContextRequest["user"], organizationId: string): void {
    const throttleKey = `${user.id}:${organizationId}`;
    const now = Date.now();
    const writtenAt = this.#lastUsedOrganizationWrittenAt.get(throttleKey);

    if (user.lastUsedOrganizationId === organizationId || (writtenAt !== undefined && now - writtenAt < LAST_USED_ORGANIZATION_THROTTLE_MS)) return;

    this.#lastUsedOrganizationWrittenAt.set(throttleKey, now);
    this.userRepository.updateById(user.id, { lastUsedOrganizationId: organizationId }).catch(error => {
      this.#logger.warn({ event: "LAST_USED_ORGANIZATION_UPDATE_FAILED", userId: user.id, organizationId, error });
    });
  }

  #forgetLastUsedOrganization(userId: string, organizationId: string): void {
    this.userRepository.updateBy({ id: userId, lastUsedOrganizationId: organizationId }, { lastUsedOrganizationId: null }).catch(error => {
      this.#logger.warn({ event: "LAST_USED_ORGANIZATION_CLEAR_FAILED", userId, organizationId, error });
    });
  }
}

function assertMember(membership: Membership | undefined): asserts membership is Membership {
  if (!membership) {
    throw createError(403, "Not a member of this organization", { errorCode: ORGANIZATION_FORBIDDEN_ERROR_CODE });
  }
}

function narrowTo(scope: ProjectScope, projectId: string): ProjectScope {
  return { kind: "projects", projectIds: scope.kind === "all" ? [projectId] : scope.projectIds.filter(id => id === projectId) };
}
