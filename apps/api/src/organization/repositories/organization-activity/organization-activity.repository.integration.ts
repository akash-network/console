import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { AbilityService } from "@src/auth/services/ability/ability.service";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { OrganizationContext } from "@src/organization/types/organization-context";
import type { UserOutput } from "@src/user/repositories";
import { type OrganizationActivityOutput, OrganizationActivityRepository, type OrganizationActivityWithActor } from "./organization-activity.repository";

import { seedOrganizationActivity, seedOrganizationInvitation, seedOrganizationWithOwner, seedProject } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
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

      const page = await runIn({ user: owner, organizationId: organization.id, role: "member", projectScope: createProjectsScope([granted.id]) }, ability =>
        repository.accessibleBy(ability, "read").findPage({ limit: 10 })
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

  describe("redactMember", () => {
    it("takes the address the member accepted an invitation at out of that team's invitations, whatever the account's own address", async () => {
      const { repository, organization, owner, member, redactInOtherOrganization, payloadsOf } = await setup();
      const accepted = await seedOrganizationInvitation({ organizationId: organization.id, status: "accepted", acceptedByUserId: member.id });
      const invitedAt = { email: accepted.email, role: "member" };
      const invitedEarlier = await seedOrganizationActivity({
        organizationId: organization.id,
        type: "member_invited",
        actorUserId: owner.id,
        payload: invitedAt
      });
      const invitedAgain = await seedOrganizationActivity({
        organizationId: organization.id,
        type: "member_invited",
        actorUserId: owner.id,
        payload: invitedAt
      });
      const someoneElse = await seedOrganizationInvitation({ organizationId: organization.id, status: "accepted", acceptedByUserId: owner.id });
      const someoneElseInvited = await seedOrganizationActivity({
        organizationId: organization.id,
        type: "member_invited",
        payload: { email: someoneElse.email, role: "admin" }
      });
      const { organization: otherTeam } = await seedOrganizationWithOwner();
      await seedOrganizationInvitation({ organizationId: otherTeam.id, email: accepted.email });
      const sameAddressInOtherTeam = await seedOrganizationActivity({ organizationId: otherTeam.id, type: "member_invited", payload: invitedAt });

      await redactInOtherOrganization(() => repository.redactMember(member.id));

      expect(await payloadsOf([invitedEarlier, invitedAgain, someoneElseInvited, sameAddressInOtherTeam])).toEqual([
        { role: "member" },
        { role: "member" },
        { email: someoneElse.email, role: "admin" },
        invitedAt
      ]);
    });

    it("takes the member's id and name out of the access changes made to them in every team, and out of no one else's", async () => {
      const { repository, organization, owner, member, redactInOtherOrganization, payloadsOf } = await setup();
      const named = { userId: member.id, username: faker.internet.userName() };
      const { organization: otherTeam } = await seedOrganizationWithOwner();
      const granted = await seedOrganizationActivity({ organizationId: organization.id, type: "member_granted", payload: { ...named, role: "admin" } });
      const revoked = await seedOrganizationActivity({ organizationId: otherTeam.id, type: "member_revoked", payload: named });
      const updated = await seedOrganizationActivity({
        organizationId: organization.id,
        type: "member_updated",
        payload: { ...named, role: "member", projectAccess: "all" }
      });
      const ownerGranted = { userId: owner.id, username: owner.username, role: "viewer" };
      const grantedToOwner = await seedOrganizationActivity({ organizationId: organization.id, type: "member_granted", payload: ownerGranted });
      const joined = await seedOrganizationActivity({
        organizationId: organization.id,
        type: "member_joined",
        actorUserId: member.id,
        payload: { role: "member" }
      });

      await redactInOtherOrganization(() => repository.redactMember(member.id));

      expect(await payloadsOf([granted, revoked, updated, grantedToOwner, joined])).toEqual([
        { role: "admin" },
        {},
        { role: "member", projectAccess: "all" },
        ownerGranted,
        { role: "member" }
      ]);
    });

    it("leaves the feed as it is when run again", async () => {
      const { repository, organization, member, payloadsOf } = await setup();
      const accepted = await seedOrganizationInvitation({ organizationId: organization.id, status: "accepted", acceptedByUserId: member.id });
      const activities = [
        await seedOrganizationActivity({ organizationId: organization.id, type: "member_invited", payload: { email: accepted.email, role: "member" } }),
        await seedOrganizationActivity({ organizationId: organization.id, type: "member_revoked", payload: { userId: member.id, username: member.username } })
      ];
      await repository.redactMember(member.id);
      const redacted = await payloadsOf(activities);

      await repository.redactMember(member.id);

      expect(await payloadsOf(activities)).toEqual(redacted);
    });
  });

  function positionOf({ createdAt, id }: OrganizationActivityWithActor) {
    return { createdAt: createdAt.toISOString(), id };
  }

  async function setup() {
    const repository = container.resolve(OrganizationActivityRepository);
    const { user: owner, organization } = await seedOrganizationWithOwner();
    const member = await seedUser({ username: faker.internet.userName(), email: faker.internet.email() });
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

    const redactInOtherOrganization = (redact: () => Promise<void>) => runIn({ user: member, organizationType: "personal" }, redact);

    const payloadsOf = async (activities: OrganizationActivityOutput[]) =>
      await Promise.all(activities.map(async ({ id }) => (await repository.findById(id))?.payload));

    return { repository, organization, owner, member, runIn, redactInOtherOrganization, payloadsOf };
  }
});
