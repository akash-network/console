import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { AbilityService } from "@src/auth/services/ability/ability.service";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { OrganizationContext } from "@src/organization/types/organization-context";
import type { UserOutput } from "@src/user/repositories";
import { OrganizationActivityRepository, type OrganizationActivityWithActor } from "./organization-activity.repository";

import { seedOrganizationActivity, seedOrganizationWithOwner, seedProject } from "@test/seeders/db/organization.seeder";
import { createOrganizationContext, createProjectsScope } from "@test/seeders/organization-context.seeder";

describe(OrganizationActivityRepository.name, () => {
  describe("findPage", () => {
    it("pages through the activities newest first without skipping or repeating those of the same instant", async () => {
      const { repository, organization, owner, runIn } = await setup();
      const sameInstant = new Date("2026-05-01T10:00:00.123Z");
      const seeded = await Promise.all([
        seedOrganizationActivity({ organizationId: organization.id, createdAt: new Date("2026-05-01T09:00:00.000Z") }),
        seedOrganizationActivity({ organizationId: organization.id, createdAt: sameInstant }),
        seedOrganizationActivity({ organizationId: organization.id, createdAt: sameInstant }),
        seedOrganizationActivity({ organizationId: organization.id, createdAt: sameInstant }),
        seedOrganizationActivity({ organizationId: organization.id, createdAt: new Date("2026-05-01T11:00:00.000Z") })
      ]);
      const newestFirst = [...seeded].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (b.id > a.id ? 1 : -1));

      const pages = await runIn({ user: owner, organizationId: organization.id }, async ability => {
        const scoped = repository.accessibleBy(ability, "read");
        const first = await scoped.findPage({ limit: 2 });
        const second = await scoped.findPage({ limit: 2, after: positionOf(first[1]) });
        const third = await scoped.findPage({ limit: 2, after: positionOf(second[1]) });

        return [first, second, third];
      });

      expect(pages.map(page => page.map(({ id }) => id))).toEqual([
        [newestFirst[0].id, newestFirst[1].id],
        [newestFirst[2].id, newestFirst[3].id],
        [newestFirst[4].id]
      ]);
    });

    it("keeps to the project it is given", async () => {
      const { repository, organization, owner, runIn } = await setup();
      const project = await seedProject({ organizationId: organization.id });
      const inProject = await seedOrganizationActivity({ organizationId: organization.id, projectId: project.id });
      await seedOrganizationActivity({ organizationId: organization.id });

      const page = await runIn({ user: owner, organizationId: organization.id }, ability =>
        repository.accessibleBy(ability, "read").findPage({ limit: 10, projectId: project.id })
      );

      expect(page.map(({ id }) => id)).toEqual([inProject.id]);
    });

    it("shows a member the activities of its granted projects and of the whole organization only", async () => {
      const { repository, organization, owner, runIn } = await setup();
      const granted = await seedProject({ organizationId: organization.id });
      const notGranted = await seedProject({ organizationId: organization.id });
      const organizationWide = await seedOrganizationActivity({ organizationId: organization.id, createdAt: new Date("2026-05-01T09:00:00.000Z") });
      const inGranted = await seedOrganizationActivity({
        organizationId: organization.id,
        projectId: granted.id,
        createdAt: new Date("2026-05-01T10:00:00.000Z")
      });
      await seedOrganizationActivity({ organizationId: organization.id, projectId: notGranted.id });
      const { organization: foreign } = await seedOrganizationWithOwner();
      await seedOrganizationActivity({ organizationId: foreign.id });

      const page = await runIn(
        { user: owner, organizationId: organization.id, role: "member", projectScope: createProjectsScope([granted.id]) },
        ability => repository.accessibleBy(ability, "read").findPage({ limit: 10 })
      );

      expect(page.map(({ id }) => id)).toEqual([inGranted.id, organizationWide.id]);
    });

    it("names who did each activity and no one for an activity without an actor", async () => {
      const { repository, organization, owner, runIn } = await setup();
      const byOwner = await seedOrganizationActivity({
        organizationId: organization.id,
        actorUserId: owner.id,
        createdAt: new Date("2026-05-01T10:00:00.000Z")
      });
      const bySystem = await seedOrganizationActivity({ organizationId: organization.id, actorUserId: null, createdAt: new Date("2026-05-01T09:00:00.000Z") });

      const page = await runIn({ user: owner, organizationId: organization.id }, ability => repository.accessibleBy(ability, "read").findPage({ limit: 10 }));

      expect(page).toEqual([
        { ...byOwner, actor: { id: owner.id, username: owner.username } },
        { ...bySystem, actor: null }
      ]);
    });
  });

  function positionOf({ createdAt, id }: OrganizationActivityWithActor) {
    return { createdAt: createdAt.toISOString(), id };
  }

  async function setup() {
    const repository = container.resolve(OrganizationActivityRepository);
    const { user: owner, organization } = await seedOrganizationWithOwner();
    const executionContextService = container.resolve(ExecutionContextService);
    const abilityService = container.resolve(AbilityService);

    const runIn = <R>(
      { user, ...context }: Partial<OrganizationContext> & { user: UserOutput },
      run: (ability: ReturnType<AbilityService["getAbilityFor"]>) => Promise<R>
    ) =>
      executionContextService.runWithContext(async () => {
        executionContextService.set("ORGANIZATION_CONTEXT", createOrganizationContext(context));
        return await run(abilityService.getAbilityFor("REGULAR_USER", user));
      });

    return { repository, organization, owner, runIn };
  }
});
