import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { GpuWaitlistEntryRepository } from "@src/gpu-waitlist/repositories/gpu-waitlist-entry/gpu-waitlist-entry.repository";
import { GpuWaitlistFulfilmentService } from "./gpu-waitlist-fulfilment.service";

import { seedGpuWaitlistEntry } from "@test/seeders/db/gpu-waitlist-entry.seeder";
import { seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import { seedPersonalOrganizationIdOf, seedUser } from "@test/seeders/db/user-with-wallet.seeder";

function inAMinute() {
  return new Date(Date.now() + 60 * 1000);
}

describe(GpuWaitlistFulfilmentService.name, () => {
  it("ends the entry when the org leases that gpu model, whatever the memory and interface", async () => {
    const { service, findEntry, user, organizationId } = await setup();
    const entry = await seedGpuWaitlistEntry({ userId: user.id, organizationId, model: "H100", memory: "80Gi", interface: "sxm5", gpuCount: 8 });

    await service.fulfilForOffers({ userId: user.id, organizationId, leaseCreatedAt: inAMinute(), offers: [{ vendor: "NVIDIA", model: "h100", count: 8 }] });

    expect(await findEntry(entry.id)).toMatchObject({ status: "fulfilled", endedAt: expect.any(Date) });
  });

  it("leaves entries for other models waiting", async () => {
    const { service, findEntry, user, organizationId } = await setup();
    const entry = await seedGpuWaitlistEntry({ userId: user.id, organizationId, model: "a100" });

    await service.fulfilForOffers({ userId: user.id, organizationId, leaseCreatedAt: inAMinute(), offers: [{ vendor: "nvidia", model: "h100", count: 8 }] });

    expect(await findEntry(entry.id)).toMatchObject({ status: "waiting", endedAt: null });
  });

  it("leaves the entries of another organization waiting", async () => {
    const { service, findEntry, user, organizationId } = await setup();
    const { organization: team } = await seedOrganizationWithOwner();
    const inTeam = await seedGpuWaitlistEntry({ userId: user.id, organizationId: team.id, model: "h100" });

    await service.fulfilForOffers({ userId: user.id, organizationId, leaseCreatedAt: inAMinute(), offers: [{ vendor: "nvidia", model: "h100", count: 8 }] });

    expect((await findEntry(inTeam.id))?.status).toBe("waiting");
  });

  it("matches on the user when the lease has no organization", async () => {
    const { service, findEntry, user } = await setup();
    const own = await seedGpuWaitlistEntry({ userId: user.id, organizationId: null, model: "h100" });
    const other = await seedGpuWaitlistEntry({ userId: (await seedUser()).id, organizationId: null, model: "h100" });

    await service.fulfilForOffers({
      userId: user.id,
      organizationId: null,
      leaseCreatedAt: inAMinute(),
      offers: [{ vendor: "nvidia", model: "h100", count: 8 }]
    });

    expect((await findEntry(own.id))?.status).toBe("fulfilled");
    expect((await findEntry(other.id))?.status).toBe("waiting");
  });

  it("leaves an entry waiting when no single lease holds as many cards as it wants", async () => {
    const { service, findEntry, user, organizationId } = await setup();
    const entry = await seedGpuWaitlistEntry({ userId: user.id, organizationId, model: "h100", gpuCount: 8 });

    await service.fulfilForOffers({ userId: user.id, organizationId, leaseCreatedAt: inAMinute(), offers: [{ vendor: "nvidia", model: "h100", count: 4 }] });

    expect((await findEntry(entry.id))?.status).toBe("waiting");
  });

  it("leaves an entry that joined after the lease was created", async () => {
    const { service, findEntry, user, organizationId } = await setup();
    const entry = await seedGpuWaitlistEntry({ userId: user.id, organizationId, model: "h100", gpuCount: 1, joinedAt: new Date() });

    await service.fulfilForOffers({
      userId: user.id,
      organizationId,
      leaseCreatedAt: new Date(Date.now() - 60 * 60 * 1000),
      offers: [{ vendor: "nvidia", model: "h100", count: 8 }]
    });

    expect((await findEntry(entry.id))?.status).toBe("waiting");
  });

  it("leaves an entry that joined at the very moment the lease was created", async () => {
    const { service, findEntry, user, organizationId } = await setup();
    const joinedAt = new Date();
    const entry = await seedGpuWaitlistEntry({ userId: user.id, organizationId, model: "h100", gpuCount: 1, joinedAt });

    await service.fulfilForOffers({ userId: user.id, organizationId, leaseCreatedAt: joinedAt, offers: [{ vendor: "nvidia", model: "h100", count: 8 }] });

    expect((await findEntry(entry.id))?.status).toBe("waiting");
  });

  it.each(["left", "expired"] as const)("leaves an entry of the same model that already ended as %s", async status => {
    const { service, findEntry, user, organizationId } = await setup();
    const entry = await seedGpuWaitlistEntry({ userId: user.id, organizationId, model: "h100", status });

    await service.fulfilForOffers({ userId: user.id, organizationId, leaseCreatedAt: inAMinute(), offers: [{ vendor: "nvidia", model: "h100", count: 8 }] });

    expect((await findEntry(entry.id))?.status).toBe(status);
  });

  it("ends a same-org teammate's waiting entry too", async () => {
    const { service, findEntry } = await setup();
    const { user: owner, organization } = await seedOrganizationWithOwner();
    const teammate = await seedUser({ userId: faker.string.uuid() });
    const entry = await seedGpuWaitlistEntry({ userId: teammate.id, organizationId: organization.id, model: "h100" });

    await service.fulfilForOffers({
      userId: owner.id,
      organizationId: organization.id,
      leaseCreatedAt: inAMinute(),
      offers: [{ vendor: "nvidia", model: "h100", count: 8 }]
    });

    expect((await findEntry(entry.id))?.status).toBe("fulfilled");
  });

  it("ends nothing for a lease with no gpu offers", async () => {
    const { service, findEntry, user, organizationId } = await setup();
    const entry = await seedGpuWaitlistEntry({ userId: user.id, organizationId, model: "h100" });

    await service.fulfilForOffers({ userId: user.id, organizationId, leaseCreatedAt: inAMinute(), offers: [] });

    expect((await findEntry(entry.id))?.status).toBe("waiting");
  });

  async function setup() {
    const user = await seedUser({ userId: faker.string.uuid() });
    const organizationId = await seedPersonalOrganizationIdOf(user.id);

    return {
      service: container.resolve(GpuWaitlistFulfilmentService),
      user,
      organizationId,
      findEntry: (id: string) => container.resolve(GpuWaitlistEntryRepository).findByIdAcrossOrganizations(id)
    };
  }
});
