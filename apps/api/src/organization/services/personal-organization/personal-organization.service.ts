import { inject, singleton } from "tsyringe";

import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { TxService } from "@src/core/services/tx/tx.service";
import { personalOrganizationName, personalOrganizationSlug } from "@src/organization/lib/personal-organization/personal-organization";
import { type OrganizationOutput, OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";
import {
  ADOPTABLE_TABLES,
  type AdoptableTable,
  type AdoptedRowCounts,
  type AdoptUserRowsInput,
  OrganizationAdoptionRepository
} from "@src/organization/repositories/organization-adoption/organization-adoption.repository";
import { OrganizationMemberRepository } from "@src/organization/repositories/organization-member/organization-member.repository";
import { ProjectRepository } from "@src/organization/repositories/project/project.repository";
import type { UserOutput } from "@src/user/repositories/user/user.repository";

/** How many numbered slugs are tried after the formulaic one before giving up. */
export const MAX_PERSONAL_SLUG_COLLISIONS = 5;

export type PersonalOrganizationUser = Pick<UserOutput, "id" | "username">;
export type AdoptableUser = Pick<UserOutput, "id" | "userId">;

@singleton()
export class PersonalOrganizationService {
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly organizationRepository: OrganizationRepository,
    private readonly organizationMemberRepository: OrganizationMemberRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly organizationAdoptionRepository: OrganizationAdoptionRepository,
    private readonly txService: TxService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: PersonalOrganizationService.name });
  }

  /** Idempotent and safe to call concurrently for the same user: the unique indexes decide who inserts, everyone else re-reads. */
  async ensureForUser(user: PersonalOrganizationUser): Promise<OrganizationOutput> {
    return await this.txService.transaction(async () => {
      const organization = await this.#ensureOrganization(user);
      await this.organizationMemberRepository.createUnlessExists({ organizationId: organization.id, userId: user.id, role: "owner" });
      await this.projectRepository.createDefaultUnlessExists({ organizationId: organization.id, createdByUserId: user.id });

      return organization;
    });
  }

  async adoptUserRows(user: AdoptableUser, organization: Pick<OrganizationOutput, "id">): Promise<AdoptedRowCounts> {
    const project = await this.projectRepository.findDefaultByOrganizationId(organization.id);

    if (!project) {
      throw new Error(`Organization ${organization.id} has no default project to file the rows of user ${user.id} into`);
    }

    const input: AdoptUserRowsInput = { userId: user.id, externalUserId: user.userId, organizationId: organization.id, projectId: project.id };
    const adopted: [AdoptableTable, number][] = [];

    for (const table of ADOPTABLE_TABLES) {
      adopted.push([table, await this.#adoptRowsOf(table, input)]);
    }

    const counts = Object.fromEntries(adopted) as AdoptedRowCounts;

    if (Object.values(counts).some(count => count > 0)) {
      this.#logger.info({ event: "USER_ROWS_ADOPTED_INTO_PERSONAL_ORGANIZATION", userId: user.id, organizationId: organization.id, ...counts });
    }

    return counts;
  }

  /** A failure on one table counts as nothing adopted there, so it never keeps the user's other rows out of the organization. */
  async #adoptRowsOf(table: AdoptableTable, input: AdoptUserRowsInput): Promise<number> {
    try {
      return await this.organizationAdoptionRepository.adoptRows(table, input);
    } catch (error) {
      this.#logger.error({ event: "USER_ROWS_ADOPTION_FAILED", table, userId: input.userId, organizationId: input.organizationId, error });
      return 0;
    }
  }

  async #ensureOrganization(user: PersonalOrganizationUser): Promise<OrganizationOutput> {
    const name = personalOrganizationName(user.username);

    for (let collisions = 0; collisions <= MAX_PERSONAL_SLUG_COLLISIONS; collisions++) {
      const claim = await this.organizationRepository.createPersonalUnlessExists({
        createdByUserId: user.id,
        name,
        slug: personalOrganizationSlug(user.id, collisions)
      });

      if (!claim) continue;

      if (claim.isNew) {
        this.#logger.info({ event: "PERSONAL_ORGANIZATION_CREATED", userId: user.id, organizationId: claim.organization.id });
      }

      return claim.organization;
    }

    throw new Error(`No free slug for the personal organization of user ${user.id} after ${MAX_PERSONAL_SLUG_COLLISIONS} collisions`);
  }
}
