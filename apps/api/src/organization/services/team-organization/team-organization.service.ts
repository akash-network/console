import createError from "http-errors";
import { inject, singleton } from "tsyringe";
import { z } from "zod";

import { AuthService } from "@src/auth/services/auth.service";
import { WalletInitializerService } from "@src/billing/services/wallet-initializer/wallet-initializer.service";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { TxService } from "@src/core/services/tx/tx.service";
import { PERSONAL_ORGANIZATION_SLUG_PREFIX } from "@src/organization/lib/personal-organization/personal-organization";
import { slugCandidates, toSlug } from "@src/organization/lib/slug/slug";
import { type OrganizationOutput, OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";
import { OrganizationMemberRepository } from "@src/organization/repositories/organization-member/organization-member.repository";
import { ProjectRepository } from "@src/organization/repositories/project/project.repository";
import type { CallerMembership } from "@src/organization/services/organization/organization.service";
import type { OrganizationContext } from "@src/organization/types/organization-context";

export const ORGANIZATION_NAME_TAKEN_ERROR_CODE = "organization_name_taken";
export const ORGANIZATION_LIMIT_REACHED_ERROR_CODE = "organization_limit_reached";
export const PERSONAL_ORGANIZATION_ERROR_CODE = "personal_organization";

/** Counts every team organization a user ever created, deleted ones included. */
export const MAX_TEAM_ORGANIZATIONS_PER_USER = 10;

export const FALLBACK_ORGANIZATION_SLUG_PREFIX = "organization";
export const TEAM_SLUG_PREFIX = "team";

const uuidSchema = z.string().uuid();

@singleton()
export class TeamOrganizationService {
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly authService: AuthService,
    private readonly organizationRepository: OrganizationRepository,
    private readonly organizationMemberRepository: OrganizationMemberRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly walletInitializerService: WalletInitializerService,
    private readonly executionContextService: ExecutionContextService,
    private readonly txService: TxService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: TeamOrganizationService.name });
  }

  /** The organization, its owner membership, default project and wallet commit together, so none of them can exist without the others. */
  async create(name: string): Promise<CallerMembership> {
    const { id: userId } = this.authService.currentUser;

    const organization = await this.txService.transaction(async () => {
      await this.organizationRepository.lockUserForOrganizationChanges(userId);
      await this.#assertBelowCreationLimit(userId);
      await this.#assertNameFree(userId, name);

      return await this.#provisionTeam(name, userId);
    });

    this.#logger.info({ event: "TEAM_ORGANIZATION_CREATED", userId, organizationId: organization.id });

    return { role: "owner", organization, isActive: false };
  }

  async rename(id: string, name: string): Promise<CallerMembership> {
    const context = this.#activeOrganization(id);
    this.#assertNotLimitedToProject();
    const { id: userId } = this.authService.currentUser;

    const organization = await this.txService.transaction(async () => {
      await this.organizationRepository.lockUserForOrganizationChanges(userId);
      await this.#assertNameFree(userId, name, id);

      return await this.organizationRepository.accessibleBy(this.authService.ability, "update").updateBy({ id, deletedAt: null }, { name }, { returning: true });
    });

    if (!organization) {
      throw organizationNotFound();
    }

    return { role: context.role, organization, isActive: true };
  }

  async #provisionTeam(name: string, userId: string): Promise<OrganizationOutput> {
    const organization = await this.organizationRepository.createTeamWithFirstFreeSlug({ name, createdByUserId: userId }, organizationSlugCandidates(name));

    if (!organization) {
      throw new Error("Every slug candidate for the organization is taken");
    }

    await this.organizationMemberRepository.unscoped("organization-creation").create({ organizationId: organization.id, userId, role: "owner" });
    await this.projectRepository.unscoped("organization-creation").createDefaultUnlessExists({ organizationId: organization.id, createdByUserId: userId });
    await this.walletInitializerService.ensureTeamWallet(organization, userId);

    return organization;
  }

  async #assertBelowCreationLimit(userId: string): Promise<void> {
    if ((await this.organizationRepository.countTeamsCreatedBy(userId)) < MAX_TEAM_ORGANIZATIONS_PER_USER) return;

    this.#logger.info({ event: "ORGANIZATION_LIMIT_REACHED", userId });
    throw createError(403, "You have reached the number of organizations you can create", { errorCode: ORGANIZATION_LIMIT_REACHED_ERROR_CODE });
  }

  async #assertNameFree(userId: string, name: string, exceptOrganizationId?: string): Promise<void> {
    if (await this.organizationMemberRepository.isMemberOfOrganizationNamed(userId, name, exceptOrganizationId)) {
      throw createError(409, "You already belong to an organization with this name", { errorCode: ORGANIZATION_NAME_TAKEN_ERROR_CODE });
    }
  }

  #assertNotLimitedToProject(): void {
    if (this.executionContextService.get("CURRENT_API_KEY")?.projectId) {
      throw createError(403, "An API key limited to a project cannot manage organizations");
    }
  }

  #activeOrganization(id: string): OrganizationContext {
    const context = this.executionContextService.get("ORGANIZATION_CONTEXT");

    if (context?.organizationId !== id) {
      throw organizationNotFound();
    }

    if (context.organizationType === "personal") {
      throw createError(403, "A personal organization cannot be renamed", { errorCode: PERSONAL_ORGANIZATION_ERROR_CODE });
    }

    return context;
  }
}

/** The organization header takes an id or a slug, so a team slug never reads as an id or as a personal organization's slug. */
function organizationSlugCandidates(name: string): string[] {
  const slug = toSlug(name);
  const isReserved = uuidSchema.safeParse(slug).success || slug.startsWith(PERSONAL_ORGANIZATION_SLUG_PREFIX);

  return slugCandidates(isReserved ? `${TEAM_SLUG_PREFIX} ${name}` : name, FALLBACK_ORGANIZATION_SLUG_PREFIX);
}

function organizationNotFound() {
  return createError(404, "Organization not found");
}
