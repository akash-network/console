import { createMongoAbility } from "@casl/ability";
import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ApiPgDatabase } from "@src/core/providers";
import { ORGANIZATION_FORBIDDEN_ERROR_CODE, OrgScopedRepository } from "@src/core/repositories/org-scoped.repository";
import type { ApiTransaction, TxService } from "@src/core/services";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { ProjectMembers } from "@src/organization/model-schemas";
import { type ProjectMemberInput, ProjectMemberRepository } from "@src/organization/repositories/project-member/project-member.repository";
import type { OrganizationContext } from "@src/organization/types/organization-context";

import { createOrganizationContext } from "@test/seeders/organization-context.seeder";
import { stubPgDriver } from "@test/services/stubbed-pg-driver";

const ORGANIZATION_PREDICATE = /"(project_members|ProjectMembers)"\."organization_id" = \$/;

class ExposedProjectMemberRepository extends ProjectMemberRepository {
  requireWrittenRow<R>(row: R | undefined): R {
    return super.requireWrittenRow(row);
  }
}

describe(OrgScopedRepository.name, () => {
  describe("in organization mode", () => {
    it.each(scopedOperations())("narrows %s to the active organization", async (_, operation) => {
      const context = createOrganizationContext();
      const { repository, executedQueries, runInContext } = setup({ context, inTransaction: true });

      await runInContext(() => operation(repository));

      const statements = executedQueries.filter(({ query }) => query !== "begin");
      expect(statements).not.toHaveLength(0);
      statements.forEach(({ query, params }) => {
        expect(query).toMatch(ORGANIZATION_PREDICATE);
        expect(params).toContain(context.organizationId);
      });
    });

    it("attributes an insert to the active organization", async () => {
      const context = createOrganizationContext();
      const { repository, executedQueries, runInContext } = setup({ context });
      const member = createProjectMemberInput();

      await runInContext(() => repository.create(member));

      expect(executedQueries).toEqual([expect.objectContaining({ params: expect.arrayContaining([context.organizationId, member.userId]) })]);
    });

    it("keeps an insert that names the active organization", async () => {
      const context = createOrganizationContext();
      const { repository, executedQueries, runInContext } = setup({ context });

      await runInContext(() => repository.create(createProjectMemberInput({ organizationId: context.organizationId })));

      expect(executedQueries).toEqual([expect.objectContaining({ params: expect.arrayContaining([context.organizationId]) })]);
    });

    it("rejects an insert naming another organization before writing it", async () => {
      const { repository, executedQueries, runInContext } = setup({ context: createOrganizationContext() });

      await expect(runInContext(() => repository.create(createProjectMemberInput({ organizationId: faker.string.uuid() })))).rejects.toMatchObject({
        status: 403,
        errorCode: ORGANIZATION_FORBIDDEN_ERROR_CODE
      });
      expect(executedQueries).toEqual([]);
    });

    it("rejects an update that sets the organization of a row, even to the active one", async () => {
      const context = createOrganizationContext();
      const { repository, executedQueries, runInContext } = setup({ context });

      await expect(runInContext(() => repository.updateById(faker.string.uuid(), { organizationId: context.organizationId }))).rejects.toMatchObject({
        status: 403,
        errorCode: ORGANIZATION_FORBIDDEN_ERROR_CODE
      });
      expect(executedQueries).toEqual([]);
    });

    it("leaves the organization out of an unscoped repository's queries", async () => {
      const { repository, executedQueries, runInContext } = setup({ context: createOrganizationContext() });

      await runInContext(() => repository.unscoped("platform-statistics").find());

      expect(executedQueries).toEqual([expect.objectContaining({ query: expect.not.stringMatching(ORGANIZATION_PREDICATE) })]);
    });

    it("lets an unscoped repository write rows of another organization as given", async () => {
      const otherOrganizationId = faker.string.uuid();
      const { repository, executedQueries, runInContext } = setup({ context: createOrganizationContext() });

      await runInContext(() =>
        repository.unscoped("personal-organization-provisioning").create(createProjectMemberInput({ organizationId: otherOrganizationId }))
      );

      expect(executedQueries).toEqual([expect.objectContaining({ params: expect.arrayContaining([otherOrganizationId]) })]);
    });

    it("lets an unscoped repository insert a row without attributing it", async () => {
      const context = createOrganizationContext();
      const { repository, executedQueries, runInContext } = setup({ context });

      await runInContext(() => repository.unscoped("personal-organization-provisioning").create(createProjectMemberInput()));

      expect(executedQueries).toEqual([expect.objectContaining({ params: expect.not.arrayContaining([context.organizationId]) })]);
    });

    it("keeps the repository it was copied from scoped", async () => {
      const context = createOrganizationContext();
      const { repository, executedQueries, runInContext } = setup({ context });

      repository.unscoped("platform-statistics");
      await runInContext(() => repository.find());

      expect(executedQueries).toEqual([expect.objectContaining({ query: expect.stringMatching(ORGANIZATION_PREDICATE) })]);
    });

    it("keeps the ability of a repository it makes unscoped", async () => {
      const userId = faker.string.uuid();
      const { repository, executedQueries, runInContext } = setup({ context: createOrganizationContext() });
      const ability = createMongoAbility([{ action: "read", subject: "ProjectMember", conditions: { userId } }]);

      await runInContext(() => repository.accessibleBy(ability, "read").unscoped("platform-statistics").find());

      expect(executedQueries).toEqual([
        expect.objectContaining({ query: expect.not.stringMatching(ORGANIZATION_PREDICATE), params: expect.arrayContaining([userId]) })
      ]);
    });

    it("keeps an unscoped repository unscoped once an ability is attached", async () => {
      const userId = faker.string.uuid();
      const { repository, executedQueries, runInContext } = setup({ context: createOrganizationContext() });
      const ability = createMongoAbility([{ action: "read", subject: "ProjectMember", conditions: { userId } }]);

      await runInContext(() => repository.unscoped("platform-statistics").accessibleBy(ability, "read").find());

      expect(executedQueries).toEqual([
        expect.objectContaining({ query: expect.not.stringMatching(ORGANIZATION_PREDICATE), params: expect.arrayContaining([userId]) })
      ]);
    });

    it("checks an insert against the ability once it is attributed", async () => {
      const context = createOrganizationContext();
      const { repository, executedQueries, runInContext } = setup({ context });
      const ability = createMongoAbility([{ action: "create", subject: "ProjectMember", conditions: { organizationId: context.organizationId } }]);

      await runInContext(() => repository.accessibleBy(ability, "create").create(createProjectMemberInput()));

      expect(executedQueries).toHaveLength(1);
    });
  });

  describe("requireWrittenRow", () => {
    it("hands back the row an upsert wrote", () => {
      const { repository } = setup({});
      const row = { id: faker.string.uuid() };

      expect(repository.requireWrittenRow(row)).toBe(row);
    });

    it("rejects an upsert that wrote nothing", () => {
      const { repository } = setup({});

      expect(() => repository.requireWrittenRow(undefined)).toThrow(expect.objectContaining({ status: 403, errorCode: ORGANIZATION_FORBIDDEN_ERROR_CODE }));
    });
  });

  describe("in legacy mode", () => {
    it("leaves reads to the user-keyed rules", async () => {
      const { repository, executedQueries, runInContext } = setup({ context: createOrganizationContext({ mode: "legacy" }) });

      await runInContext(() => repository.find({ userId: faker.string.uuid() }));

      expect(executedQueries).toEqual([expect.objectContaining({ query: expect.not.stringMatching(ORGANIZATION_PREDICATE) })]);
    });

    it("still attributes inserts to the active organization", async () => {
      const context = createOrganizationContext({ mode: "legacy" });
      const { repository, executedQueries, runInContext } = setup({ context });

      await runInContext(() => repository.create(createProjectMemberInput()));

      expect(executedQueries).toEqual([expect.objectContaining({ params: expect.arrayContaining([context.organizationId]) })]);
    });

    it("rejects an insert naming another organization", async () => {
      const { repository, runInContext } = setup({ context: createOrganizationContext({ mode: "legacy" }) });

      await expect(runInContext(() => repository.create(createProjectMemberInput({ organizationId: faker.string.uuid() })))).rejects.toMatchObject({
        status: 403
      });
    });

    it("rejects an update that sets the organization of a row", async () => {
      const { repository, executedQueries, runInContext } = setup({ context: createOrganizationContext({ mode: "legacy" }) });

      await expect(runInContext(() => repository.updateManyById([faker.string.uuid()], { organizationId: faker.string.uuid() }))).rejects.toMatchObject({
        status: 403
      });
      expect(executedQueries).toEqual([]);
    });
  });

  describe("without an organization context", () => {
    it("reads and writes rows as given inside a request that has none", async () => {
      const organizationId = faker.string.uuid();
      const { repository, executedQueries, runInContext } = setup({});

      await runInContext(async () => {
        await repository.find();
        await repository.create(createProjectMemberInput({ organizationId }));
        await repository.updateById(faker.string.uuid(), { organizationId });
      });

      expect(executedQueries.map(({ query }) => query)).toEqual([
        expect.not.stringMatching(ORGANIZATION_PREDICATE),
        expect.stringContaining("insert"),
        expect.not.stringMatching(ORGANIZATION_PREDICATE)
      ]);
      expect(executedQueries[1].params).toContain(organizationId);
    });

    it("reads and inserts rows as given outside any execution context", async () => {
      const organizationId = faker.string.uuid();
      const { repository, executedQueries } = setup({});

      await repository.find();
      await repository.create(createProjectMemberInput({ organizationId }));

      expect(executedQueries).toEqual([
        expect.objectContaining({ query: expect.not.stringMatching(ORGANIZATION_PREDICATE) }),
        expect.objectContaining({ params: expect.arrayContaining([organizationId]) })
      ]);
    });
  });

  function scopedOperations(): Array<[string, (repository: ProjectMemberRepository) => Promise<unknown>]> {
    const id = faker.string.uuid();

    return [
      ["find", repository => repository.find({ userId: id })],
      ["findOneBy", repository => repository.findOneBy({ userId: id })],
      ["findById", repository => repository.findById(id)],
      ["findOneByAndLock", repository => repository.findOneByAndLock({ id })],
      ["count", repository => repository.count()],
      ["paginate", repository => repository.paginate({ query: { userId: id } }, async () => {})],
      ["updateById", repository => repository.updateById(id, { role: "viewer" })],
      ["updateBy", repository => repository.updateBy({ userId: id }, { role: "viewer" })],
      ["updateManyById", repository => repository.updateManyById([id], { role: "viewer" })],
      ["deleteById", repository => repository.deleteById(id)],
      ["deleteBy", repository => repository.deleteBy({ userId: id })]
    ];
  }

  function createProjectMemberInput(overrides: Partial<ProjectMemberInput> = {}) {
    return { projectId: faker.string.uuid(), userId: faker.string.uuid(), role: "member", ...overrides } as ProjectMemberInput;
  }

  function setup(input: { context?: OrganizationContext; inTransaction?: boolean }) {
    const { db, executedQueries, respondWith } = stubPgDriver({ schema: { ProjectMembers }, table: ProjectMembers });
    const pg = db as unknown as ApiPgDatabase;
    const txManager = mock<TxService>();
    txManager.getPgTx.mockReturnValue(input.inTransaction ? (db as unknown as ApiTransaction) : undefined);
    const executionContextService = new ExecutionContextService(vi.fn(() => mock()));
    const repository = new ExposedProjectMemberRepository(pg, ProjectMembers, txManager, executionContextService);
    const runInContext = <R>(run: () => Promise<R>) =>
      executionContextService.runWithContext(async () => {
        executionContextService.set("ORGANIZATION_CONTEXT", input.context);
        return await run();
      });

    return { repository, executedQueries, respondWith, runInContext };
  }
});
