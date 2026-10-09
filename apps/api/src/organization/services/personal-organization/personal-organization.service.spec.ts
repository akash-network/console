import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core/providers/logging.provider";
import type { TxService } from "@src/core/services/tx/tx.service";
import { FALLBACK_PERSONAL_ORGANIZATION_NAME } from "@src/organization/lib/personal-organization/personal-organization";
import { MAX_ORGANIZATION_NAME_LENGTH } from "@src/organization/model-schemas/organization/organization.schema";
import type { OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";
import {
  ADOPTABLE_TABLES,
  type AdoptableTable,
  type AdoptedRowCounts,
  type OrganizationAdoptionRepository
} from "@src/organization/repositories/organization-adoption/organization-adoption.repository";
import type { OrganizationMemberRepository } from "@src/organization/repositories/organization-member/organization-member.repository";
import type { ProjectRepository } from "@src/organization/repositories/project/project.repository";
import { MAX_PERSONAL_SLUG_COLLISIONS, PersonalOrganizationService } from "./personal-organization.service";

import { createAdoptedRowCounts, createOrganization, createProject } from "@test/seeders/organization.seeder";
import { createUser } from "@test/seeders/user.seeder";

const USER_ID = "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0";

describe(PersonalOrganizationService.name, () => {
  describe("ensureForUser", () => {
    it("claims the personal organization named after the user under the formulaic slug", async () => {
      const user = createUser({ id: USER_ID, username: "alice" });
      const { service, organizationRepository } = setup();

      await service.ensureForUser(user);

      expect(organizationRepository.createPersonalUnlessExists).toHaveBeenCalledWith({
        createdByUserId: USER_ID,
        name: "alice",
        slug: "personal-0f1e2d3c4b5a"
      });
    });

    it("names the organization after the fallback for a user without a username", async () => {
      const user = createUser({ username: null });
      const { service, organizationRepository } = setup();

      await service.ensureForUser(user);

      expect(organizationRepository.createPersonalUnlessExists).toHaveBeenCalledWith(expect.objectContaining({ name: FALLBACK_PERSONAL_ORGANIZATION_NAME }));
    });

    it("cuts a long username down to the organization name length", async () => {
      const user = createUser({ username: "b".repeat(MAX_ORGANIZATION_NAME_LENGTH + 1) });
      const { service, organizationRepository } = setup();

      await service.ensureForUser(user);

      expect(organizationRepository.createPersonalUnlessExists).toHaveBeenCalledWith(
        expect.objectContaining({ name: "b".repeat(MAX_ORGANIZATION_NAME_LENGTH) })
      );
    });

    it("makes the user the owner and gives the organization its default project inside one transaction", async () => {
      const user = createUser();
      const { service, organization, organizationMemberRepository, projectRepository, txService } = setup();
      const order: string[] = [];
      txService.transaction.mockImplementation(async cb => {
        order.push("begin");
        const result = await cb();
        order.push("commit");
        return result;
      });
      organizationMemberRepository.createUnlessExists.mockImplementation(async () => {
        order.push("member");
        return undefined;
      });
      projectRepository.createDefaultUnlessExists.mockImplementation(async () => {
        order.push("project");
        return undefined;
      });

      const result = await service.ensureForUser(user);

      expect(result).toBe(organization);
      expect(organizationMemberRepository.createUnlessExists).toHaveBeenCalledWith({ organizationId: organization.id, userId: user.id, role: "owner" });
      expect(projectRepository.createDefaultUnlessExists).toHaveBeenCalledWith({ organizationId: organization.id, createdByUserId: user.id });
      expect(order).toEqual(["begin", "member", "project", "commit"]);
    });

    it("logs the creation of a new personal organization", async () => {
      const user = createUser();
      const { service, organization, logger } = setup();

      await service.ensureForUser(user);

      expect(logger.info).toHaveBeenCalledWith({ event: "PERSONAL_ORGANIZATION_CREATED", userId: user.id, organizationId: organization.id });
    });

    it("hands back an existing organization without logging a creation, and still ensures its membership and project", async () => {
      const user = createUser();
      const { service, organization, organizationMemberRepository, projectRepository, logger } = setup({ isNew: false });

      const result = await service.ensureForUser(user);

      expect(result).toBe(organization);
      expect(logger.info).not.toHaveBeenCalled();
      expect(organizationMemberRepository.createUnlessExists).toHaveBeenCalledOnce();
      expect(projectRepository.createDefaultUnlessExists).toHaveBeenCalledOnce();
    });

    it("moves on to numbered slugs while the slug belongs to another organization", async () => {
      const user = createUser({ id: USER_ID });
      const { service, organization, organizationRepository } = setup();
      organizationRepository.createPersonalUnlessExists
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ organization, isNew: true });

      const result = await service.ensureForUser(user);

      expect(result).toBe(organization);
      expect(organizationRepository.createPersonalUnlessExists.mock.calls.map(([input]) => input.slug)).toEqual([
        "personal-0f1e2d3c4b5a",
        "personal-0f1e2d3c4b5a-2",
        "personal-0f1e2d3c4b5a-3"
      ]);
    });

    it("gives up once the numbered slugs are taken as well", async () => {
      const user = createUser();
      const { service, organizationRepository, organizationMemberRepository } = setup();
      organizationRepository.createPersonalUnlessExists.mockResolvedValue(undefined);

      await expect(service.ensureForUser(user)).rejects.toThrow(/No free slug/);

      expect(organizationRepository.createPersonalUnlessExists).toHaveBeenCalledTimes(MAX_PERSONAL_SLUG_COLLISIONS + 1);
      expect(organizationMemberRepository.createUnlessExists).not.toHaveBeenCalled();
    });
  });

  describe("adoptUserRows", () => {
    it("stamps the user's rows in every table with the organization and its default project", async () => {
      const user = createUser();
      const adopted = createAdoptedRowCounts({ userWallets: 1, deploymentSettings: 3 });
      const { service, organization, project, organizationAdoptionRepository } = setup({ adopted });

      const result = await service.adoptUserRows(user, organization);

      expect(result).toEqual(adopted);
      const input = { userId: user.id, externalUserId: user.userId, organizationId: organization.id, projectId: project.id };
      expect(organizationAdoptionRepository.adoptRows.mock.calls).toEqual(ADOPTABLE_TABLES.map(table => [table, input]));
    });

    it("still files the other tables when one of them fails, and logs the failure", async () => {
      const user = createUser();
      const error = new Error("lock timeout");
      const { service, organization, organizationAdoptionRepository, logger } = setup();
      organizationAdoptionRepository.adoptRows.mockImplementation(async table => {
        if (table === "walletSettings") throw error;
        return 1;
      });

      const result = await service.adoptUserRows(user, organization);

      expect(result).toEqual({ userWallets: 1, walletSettings: 0, paymentMethods: 1, stripeTransactions: 1, deploymentSettings: 1, apiKeys: 1, templates: 1 });
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith({
        event: "USER_ROWS_ADOPTION_FAILED",
        table: "walletSettings",
        userId: user.id,
        organizationId: organization.id,
        error
      });
    });

    it("refuses to file rows into an organization without a default project", async () => {
      const user = createUser();
      const { service, organization, projectRepository, organizationAdoptionRepository } = setup();
      projectRepository.findDefaultByOrganizationId.mockResolvedValue(undefined);

      await expect(service.adoptUserRows(user, organization)).rejects.toThrow(/no default project/);

      expect(organizationAdoptionRepository.adoptRows).not.toHaveBeenCalled();
    });

    it("logs what was adopted when any row was", async () => {
      const user = createUser();
      const { service, organization, logger } = setup({ adopted: { deploymentSettings: 3 } });

      await service.adoptUserRows(user, organization);

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "USER_ROWS_ADOPTED_INTO_PERSONAL_ORGANIZATION",
          userId: user.id,
          organizationId: organization.id,
          deploymentSettings: 3
        })
      );
    });

    it("stays quiet when there was nothing left to adopt", async () => {
      const user = createUser();
      const { service, organization, logger } = setup();

      await service.adoptUserRows(user, organization);

      expect(logger.info).not.toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
    });
  });

  it("creates the logger with the service context", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: PersonalOrganizationService.name });
  });

  function setup(input: { isNew?: boolean; adopted?: Partial<AdoptedRowCounts> } = {}) {
    const adopted = createAdoptedRowCounts(input.adopted);
    const organization = createOrganization({ type: "personal" });
    const project = createProject({ organizationId: organization.id, isDefault: true });
    const organizationRepository = mock<OrganizationRepository>({
      createPersonalUnlessExists: vi.fn().mockResolvedValue({ organization, isNew: input.isNew ?? true })
    });
    const organizationMemberRepository = mock<OrganizationMemberRepository>({ createUnlessExists: vi.fn().mockResolvedValue(undefined) });
    const projectRepository = mock<ProjectRepository>({
      createDefaultUnlessExists: vi.fn().mockResolvedValue(undefined),
      findDefaultByOrganizationId: vi.fn().mockResolvedValue(project)
    });
    const organizationAdoptionRepository = mock<OrganizationAdoptionRepository>({ adoptRows: vi.fn(async (table: AdoptableTable) => adopted[table]) });
    const txService = mock<TxService>({ transaction: vi.fn(cb => cb()) });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const service = new PersonalOrganizationService(
      organizationRepository,
      organizationMemberRepository,
      projectRepository,
      organizationAdoptionRepository,
      txService,
      createLogger
    );

    return {
      service,
      organization,
      project,
      organizationRepository,
      organizationMemberRepository,
      projectRepository,
      organizationAdoptionRepository,
      txService,
      logger,
      createLogger
    };
  }
});
