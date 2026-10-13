import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { DeploymentDepositRepository } from "./deployment-deposit.repository";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { findDeploymentDeposit, seedDeploymentDeposit } from "@test/seeders/db/deployment-deposit.seeder";
import { seedOrganizationWithOwner, seedProject } from "@test/seeders/db/organization.seeder";
import { createOrganizationContext } from "@test/seeders/organization-context.seeder";

describe(DeploymentDepositRepository.name, () => {
  describe("createMany", () => {
    it("writes the rows pending and returns them", async () => {
      const { repository, organization, project } = await setup();

      const [created] = await repository.createMany([
        {
          organizationId: organization.id,
          projectId: project.id,
          owner: "akash1owner",
          dseq: "42",
          kind: "deployment_create",
          amount: "5000000",
          denom: "uact",
          amountCents: 500
        }
      ]);

      expect(await findDeploymentDeposit(created.id)).toMatchObject({ status: "pending", projectId: project.id, amountCents: 500, txHash: null });
    });

    it("writes nothing for no rows", async () => {
      const { repository } = await setup();

      expect(await repository.createMany([])).toEqual([]);
    });

    it("refuses a row for another organization than the request's", async () => {
      const { repository, organization } = await setup();
      const { organization: other } = await seedOrganizationWithOwner();

      await expect(
        runInOrganization(organization.id, () =>
          repository.createMany([{ organizationId: other.id, owner: "akash1owner", dseq: "43", kind: "top_up", amount: "1", denom: "uact", amountCents: 0 }])
        )
      ).rejects.toMatchObject({ status: 403 });
    });
  });

  describe("settlePending", () => {
    it("settles pending rows with the transaction hash and leaves settled rows as they were", async () => {
      const { repository, organization } = await setup();
      const pending = await seedDeploymentDeposit({ organizationId: organization.id, status: "pending" });
      const voided = await seedDeploymentDeposit({ organizationId: organization.id, status: "void" });

      await repository.settlePending([pending.id, voided.id], { status: "confirmed", txHash: "HASH" });

      expect(await findDeploymentDeposit(pending.id)).toMatchObject({ status: "confirmed", txHash: "HASH" });
      expect(await findDeploymentDeposit(voided.id)).toMatchObject({ status: "void", txHash: null });
    });

    it("keeps the stored hash when settling without one", async () => {
      const { repository, organization } = await setup();
      const pending = await seedDeploymentDeposit({ organizationId: organization.id, status: "pending", txHash: "KEPT" });

      await repository.settlePending([pending.id], { status: "void" });

      expect(await findDeploymentDeposit(pending.id)).toMatchObject({ status: "void", txHash: "KEPT" });
    });

    it("does nothing for no rows", async () => {
      const { repository } = await setup();

      await expect(repository.settlePending([], { status: "void" })).resolves.toBeUndefined();
    });
  });

  describe("attachTxHash", () => {
    it("keeps the rows pending under the hash", async () => {
      const { repository, organization } = await setup();
      const pending = await seedDeploymentDeposit({ organizationId: organization.id, status: "pending" });

      await repository.attachTxHash([pending.id], "UNDECIDED");
      await repository.attachTxHash([], "IGNORED");

      expect(await findDeploymentDeposit(pending.id)).toMatchObject({ status: "pending", txHash: "UNDECIDED" });
    });
  });

  describe("settlePendingByTxHash", () => {
    it("settles only the pending rows of that hash and counts them", async () => {
      const { repository, organization } = await setup();
      const pending = await seedDeploymentDeposit({ organizationId: organization.id, status: "pending", txHash: "HASH" });
      const alreadySettled = await seedDeploymentDeposit({ organizationId: organization.id, status: "void", txHash: "HASH" });
      const otherHash = await seedDeploymentDeposit({ organizationId: organization.id, status: "pending", txHash: "OTHER" });

      const settled = await repository.settlePendingByTxHash("HASH", "confirmed");

      expect(settled).toBe(1);
      expect(await findDeploymentDeposit(pending.id)).toMatchObject({ status: "confirmed" });
      expect(await findDeploymentDeposit(alreadySettled.id)).toMatchObject({ status: "void" });
      expect(await findDeploymentDeposit(otherHash.id)).toMatchObject({ status: "pending" });
    });
  });

  describe("findCreateProjectIds", () => {
    it("returns the project of each deployment's earliest live create of the owner", async () => {
      const { repository, organization, project } = await setup();
      const owner = createAkashAddress();
      const otherProject = await seedProject({ organizationId: organization.id });
      const seedCreate = (input: Partial<Parameters<typeof seedDeploymentDeposit>[0]>) =>
        seedDeploymentDeposit({ organizationId: organization.id, owner, kind: "deployment_create", status: "pending", ...input });
      await seedCreate({ dseq: "101", projectId: project.id, createdAt: new Date("2026-10-01T00:00:00Z") });
      await seedCreate({ dseq: "101", projectId: otherProject.id, status: "confirmed", createdAt: new Date("2026-10-02T00:00:00Z") });
      await seedCreate({ dseq: "102", projectId: project.id, status: "void" });
      await seedCreate({ dseq: "103", projectId: null });
      await seedCreate({ dseq: "104", projectId: project.id, owner: createAkashAddress() });
      await seedCreate({ dseq: "105", projectId: project.id, kind: "top_up" });
      await seedCreate({ dseq: "106", projectId: project.id });

      const projectIds = await repository.findCreateProjectIds(organization.id, owner, ["101", "102", "103", "104", "105"]);

      expect(projectIds).toEqual(new Map([["101", project.id]]));
      expect(await repository.findCreateProjectIds(organization.id, owner, [])).toEqual(new Map());
    });
  });

  describe("findFirstRecordedAt", () => {
    it("returns when the organization's first deposit was recorded", async () => {
      const { repository, organization } = await setup();
      await seedDeploymentDeposit({ organizationId: organization.id, createdAt: new Date("2026-10-05T10:00:00.000Z") });
      await seedDeploymentDeposit({ organizationId: organization.id, createdAt: new Date("2026-10-03T10:00:00.000Z"), status: "void" });

      expect(await repository.findFirstRecordedAt(organization.id)).toEqual(new Date("2026-10-03T10:00:00.000Z"));
    });

    it("returns nothing for an organization with no recorded deposit", async () => {
      const { repository, organization } = await setup();

      expect(await repository.findFirstRecordedAt(organization.id)).toBeUndefined();
    });
  });

  describe("sumCommittedByProject", () => {
    it("sums the pending and confirmed deposits of the window per project, unassigned ones under no project", async () => {
      const { repository, organization, project } = await setup();
      const { organization: other } = await seedOrganizationWithOwner();
      const inWindow = new Date("2026-10-10T00:00:00.000Z");
      await seedDeploymentDeposit({ organizationId: organization.id, projectId: project.id, amountCents: 100, status: "confirmed", createdAt: inWindow });
      await seedDeploymentDeposit({ organizationId: organization.id, projectId: project.id, amountCents: 50, status: "pending", createdAt: inWindow });
      await seedDeploymentDeposit({ organizationId: organization.id, projectId: project.id, amountCents: 999, status: "void", createdAt: inWindow });
      await seedDeploymentDeposit({ organizationId: organization.id, amountCents: 30, createdAt: inWindow });
      await seedDeploymentDeposit({ organizationId: organization.id, projectId: project.id, amountCents: 7, createdAt: new Date("2026-10-01T00:00:00.000Z") });
      await seedDeploymentDeposit({
        organizationId: organization.id,
        projectId: project.id,
        amountCents: 999,
        createdAt: new Date("2026-11-01T00:00:00.000Z")
      });
      await seedDeploymentDeposit({ organizationId: other.id, amountCents: 999, createdAt: inWindow });

      const committed = await repository.sumCommittedByProject(organization.id, {
        from: new Date("2026-10-01T00:00:00.000Z"),
        to: new Date("2026-11-01T00:00:00.000Z")
      });

      expect(committed).toHaveLength(2);
      expect(committed).toEqual(
        expect.arrayContaining([
          { projectId: project.id, amountCents: 157 },
          { projectId: null, amountCents: 30 }
        ])
      );
    });
  });

  async function runInOrganization<T>(organizationId: string, cb: () => Promise<T>): Promise<T> {
    const executionContextService = container.resolve(ExecutionContextService);

    return await executionContextService.runWithContext(async () => {
      executionContextService.set("ORGANIZATION_CONTEXT", createOrganizationContext({ organizationId }));
      return await cb();
    });
  }

  async function setup() {
    const { organization } = await seedOrganizationWithOwner();
    const project = await seedProject({ organizationId: organization.id });

    return { repository: container.resolve(DeploymentDepositRepository), organization, project };
  }
});
