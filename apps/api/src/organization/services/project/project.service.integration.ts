import { and, eq, isNull } from "drizzle-orm";
import { setTimeout as delay } from "node:timers/promises";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AbilityService } from "@src/auth/services/ability/ability.service";
import { type ApiPgDatabase, POSTGRES_DB, resolveTable } from "@src/core";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { ORGANIZATION_CONFIG } from "@src/organization/providers/config.provider";
import { OrganizationActivityService } from "@src/organization/services/organization-activity/organization-activity.service";
import { PROJECT_LIMIT_REACHED_ERROR_CODE, ProjectService } from "./project.service";

import { seedOrganizationWithOwner, seedProject } from "@test/seeders/db/organization.seeder";
import { createOrganizationContext } from "@test/seeders/organization-context.seeder";

describe(ProjectService.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("create", () => {
    it("creates only one of the projects requested at once for the last free place", async () => {
      const { service, organizationId, projectLimit, runAsOwner, slowDownActivityRecording, countLiveProjects } = await setup();
      for (let index = 2; index < projectLimit; index++) {
        await seedProject({ organizationId });
      }
      slowDownActivityRecording();

      const outcomes = await Promise.allSettled(["first", "second", "third"].map(name => runAsOwner(() => service.create({ name }))));

      expect(outcomes.map(outcome => outcome.status).sort()).toEqual(["fulfilled", "rejected", "rejected"]);
      expect(outcomes.filter(outcome => outcome.status === "rejected")).toEqual([
        expect.objectContaining({ reason: expect.objectContaining({ status: 403, errorCode: PROJECT_LIMIT_REACHED_ERROR_CODE }) }),
        expect.objectContaining({ reason: expect.objectContaining({ status: 403, errorCode: PROJECT_LIMIT_REACHED_ERROR_CODE }) })
      ]);
      expect(await countLiveProjects()).toBe(projectLimit);
    });
  });

  async function setup() {
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const service = container.resolve(ProjectService);
    const executionContextService = container.resolve(ExecutionContextService);
    const abilityService = container.resolve(AbilityService);
    const organizationActivityService = container.resolve(OrganizationActivityService);
    const projectLimit = container.resolve(ORGANIZATION_CONFIG).PROJECTS_PER_ORGANIZATION_LIMIT;
    const { user, organization } = await seedOrganizationWithOwner({ type: "team" });

    function runAsOwner<R>(act: () => Promise<R>) {
      return executionContextService.runWithContext(async () => {
        executionContextService.set("CURRENT_USER", user);
        executionContextService.set("ORGANIZATION_CONTEXT", createOrganizationContext({ organizationId: organization.id, role: "owner" }));
        executionContextService.set("ABILITY", abilityService.getAbilityFor("REGULAR_USER", user));

        return await act();
      });
    }

    function slowDownActivityRecording() {
      const record = organizationActivityService.record.bind(organizationActivityService);
      vi.spyOn(organizationActivityService, "record").mockImplementation(async (...args) => {
        await delay(100);
        return await record(...args);
      });
    }

    async function countLiveProjects() {
      const projects = resolveTable("Projects");
      const rows = await db
        .select()
        .from(projects)
        .where(and(eq(projects.organizationId, organization.id), isNull(projects.deletedAt)));

      return rows.length;
    }

    return { service, organizationId: organization.id, projectLimit, runAsOwner, slowDownActivityRecording, countLiveProjects };
  }
});
