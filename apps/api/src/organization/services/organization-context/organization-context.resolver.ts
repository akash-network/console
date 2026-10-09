import { millisecondsInMinute } from "date-fns";
import createError from "http-errors";
import { LRUCache } from "lru-cache";
import { inject, singleton } from "tsyringe";
import { z } from "zod";

import type { ApiKeyOutput } from "@src/auth/repositories/api-key/api-key.repository";
import { cacheRegistry, nominalEntrySizing } from "@src/caching/cache-registry";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
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
export const ORGANIZATION_FORBIDDEN_ERROR_CODE = "organization_forbidden";
export const PROJECT_FORBIDDEN_ERROR_CODE = "project_forbidden";

export const LAST_USED_ORGANIZATION_THROTTLE_MS = millisecondsInMinute;
const MAX_TRACKED_USERS = 1e5;
const LAST_USED_ORGANIZATION_ENTRY_BYTES = 64;

const uuidSchema = z.string().uuid();

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
  }

  async resolve(request: OrganizationContextRequest): Promise<OrganizationContext | undefined> {
    const isOrganizationsOn = this.featureFlagsService.isEnabled(FeatureFlags.ORGANIZATIONS, { userId: request.user.id });
    const mode: AuthorizationMode =
      isOrganizationsOn || this.featureFlagsService.isEnabled(FeatureFlags.ORGANIZATIONS_ENFORCE, { userId: request.user.id }) ? "organization" : "legacy";

    if (!isOrganizationsOn) {
      return await this.#resolvePersonalContext(request.user, mode);
    }

    const { role, organization } = await this.#resolveMembership(request);
    const roleScope = await this.#projectScopeOf(role, organization.id, request.user.id);
    const keyScope = request.apiKey?.projectId ? narrowTo(roleScope, request.apiKey.projectId) : roleScope;
    const projectScope = request.projectHeader ? await this.#narrowToRequestedProject(keyScope, organization.id, request.projectHeader) : keyScope;

    return { organizationId: organization.id, organizationType: organization.type, role, projectScope, mode };
  }

  async #resolvePersonalContext(user: OrganizationContextRequest["user"], mode: AuthorizationMode): Promise<OrganizationContext | undefined> {
    try {
      const { organization } = await this.#personalMembership(user);
      return { organizationId: organization.id, organizationType: organization.type, role: "owner", projectScope: { kind: "all" }, mode };
    } catch (error) {
      if (mode === "organization") throw error;

      this.#logger.error({ event: "PERSONAL_ORGANIZATION_CONTEXT_UNAVAILABLE", userId: user.id, error });
      return undefined;
    }
  }

  async #resolveMembership({ user, apiKey, organizationHeader }: OrganizationContextRequest): Promise<Membership> {
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
      const lookup = uuidSchema.safeParse(organizationHeader).success ? { id: organizationHeader } : { slug: organizationHeader };
      const membership = await this.organizationMemberRepository.findActiveMembership(user.id, lookup);
      assertMember(membership);
      this.#rememberLastUsedOrganization(user, membership.organization.id);

      return membership;
    }

    const lastUsedMembership =
      user.lastUsedOrganizationId && (await this.organizationMemberRepository.findActiveMembership(user.id, { id: user.lastUsedOrganizationId }));

    return lastUsedMembership || (await this.#personalMembership(user));
  }

  async #personalMembership(user: OrganizationContextRequest["user"]): Promise<Membership> {
    const membership = await this.organizationMemberRepository.findActiveMembership(user.id, { type: "personal" });

    return membership ?? { role: "owner", organization: await this.personalOrganizationService.ensureForUser(user) };
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
    if (!uuidSchema.safeParse(projectId).success) return false;
    if (scope.kind === "projects") return scope.projectIds.includes(projectId);

    return !!(await this.projectRepository.findActive(organizationId, projectId));
  }

  #rememberLastUsedOrganization(user: OrganizationContextRequest["user"], organizationId: string): void {
    const now = Date.now();
    const writtenAt = this.#lastUsedOrganizationWrittenAt.get(user.id);

    if (user.lastUsedOrganizationId === organizationId || (writtenAt !== undefined && now - writtenAt < LAST_USED_ORGANIZATION_THROTTLE_MS)) return;

    this.#lastUsedOrganizationWrittenAt.set(user.id, now);
    this.userRepository.updateById(user.id, { lastUsedOrganizationId: organizationId }).catch(error => {
      this.#logger.warn({ event: "LAST_USED_ORGANIZATION_UPDATE_FAILED", userId: user.id, organizationId, error });
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
