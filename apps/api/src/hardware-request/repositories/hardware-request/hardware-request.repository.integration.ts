import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { HardwareRequestEventRepository } from "@src/hardware-request/repositories/hardware-request-event/hardware-request-event.repository";
import { HardwareRequestOfferRepository } from "@src/hardware-request/repositories/hardware-request-offer/hardware-request-offer.repository";
import { HardwareRequestRepository } from "./hardware-request.repository";

import { seedHardwareRequest } from "@test/seeders/db/hardware-request.seeder";
import { seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

describe(HardwareRequestRepository.name, () => {
  describe("claimByContactEmail", () => {
    it("hands the unclaimed requests filed for the address to the account, whatever the address's case and padding", async () => {
      const { repository, email, user, organization } = await setup();
      const unclaimed = await seedHardwareRequest({ userId: null, contactEmail: email.toUpperCase() });

      const claimed = await repository.claimByContactEmail(` ${email} `, { userId: user.id, organizationId: organization.id });

      expect(claimed).toMatchObject([{ id: unclaimed.id, userId: user.id, organizationId: organization.id }]);
      expect(await repository.findById(unclaimed.id)).toMatchObject({ userId: user.id, organizationId: organization.id });
    });

    it("leaves requests that already have a user, or another address, alone", async () => {
      const { repository, email, user, organization } = await setup();
      const someoneElse = await seedUser();
      const owned = await seedHardwareRequest({ userId: someoneElse.id, contactEmail: email });
      const otherAddress = await seedHardwareRequest({ userId: null, contactEmail: faker.internet.email() });

      await expect(repository.claimByContactEmail(email, { userId: user.id, organizationId: organization.id })).resolves.toEqual([]);
      expect(await repository.findById(owned.id)).toMatchObject({ userId: someoneElse.id });
      expect(await repository.findById(otherAddress.id)).toMatchObject({ userId: null });
    });
  });

  describe("findQueue by response target", () => {
    it("finds open requests that missed a target, and those reminded about one still unmet", async () => {
      const { user } = await setup();
      const gpuModel = faker.string.alphanumeric(12);
      const [past, future, repliedAt] = [new Date(Date.now() - 60_000), new Date(Date.now() + 3_600_000), new Date()];
      const seed = (overrides: Parameters<typeof seedHardwareRequest>[0]) => seedHardwareRequest({ gpuModel, ...overrides });
      const requests = {
        replyMissed: await seed({ userId: user.id, firstReplyDueAt: past, firstOfferDueAt: future }),
        offerMissed: await seed({ userId: user.id, firstRepliedAt: repliedAt, firstReplyDueAt: past, firstOfferDueAt: past }),
        offerMade: await seed({ userId: user.id, firstRepliedAt: repliedAt, firstReplyDueAt: past, firstOfferDueAt: past }),
        replyAtRisk: await seed({ userId: user.id, firstReplyDueAt: future, firstOfferDueAt: future }),
        offerAtRisk: await seed({ userId: user.id, firstRepliedAt: repliedAt, firstReplyDueAt: past, firstOfferDueAt: future }),
        remindedThenReplied: await seed({ userId: user.id, firstRepliedAt: repliedAt, firstReplyDueAt: future, firstOfferDueAt: future }),
        settled: await seed({ userId: user.id, status: "closed", firstReplyDueAt: past, firstOfferDueAt: past }),
        legacy: await seed({ userId: user.id })
      };
      const offers = container.resolve(HardwareRequestOfferRepository);
      await offers.create({ ...anOffer(requests.offerMade.id), status: "published", publishedAt: past });
      await offers.create({ ...anOffer(requests.offerAtRisk.id), status: "draft" });
      const events = container.resolve(HardwareRequestEventRepository);
      for (const [request, target] of [
        [requests.replyAtRisk, "first_reply"],
        [requests.offerAtRisk, "first_offer"],
        [requests.remindedThenReplied, "first_reply"],
        [requests.replyMissed, "first_reply"]
      ] as const) {
        await events.record({ hardwareRequestId: request.id, type: "reminder_sent", actor: null, payload: { target } });
      }
      const queue = container.resolve(HardwareRequestRepository).unscoped("gpu-request-broker");
      const idsStanding = async (responseTarget: "at_risk" | "missed") =>
        (await queue.findQueue({ gpuModel, responseTarget, order: "oldest", limit: 50, offset: 0 })).map(({ id }) => id);

      await expect(idsStanding("missed")).resolves.toEqual([requests.replyMissed.id, requests.offerMissed.id]);
      await expect(idsStanding("at_risk")).resolves.toEqual([requests.replyAtRisk.id, requests.offerAtRisk.id]);
    });
  });

  function anOffer(hardwareRequestId: string) {
    return {
      hardwareRequestId,
      providerAddress: "akash1provider",
      providerAudited: true,
      providerUptime7d: 0.99,
      usdPerGpuHour: 2.4,
      terms: {
        gpu: { model: "H100", count: 8, interconnect: "server" as const },
        location: "Frankfurt, DE",
        availableFrom: "2026-12-01",
        term: "6_months" as const,
        sla: null,
        storage: { tbPerNode: 4, nvme: true },
        uplinkGbps: null
      },
      expiresAt: new Date(Date.now() + 86_400_000)
    };
  }

  async function setup() {
    const { user, organization } = await seedOrganizationWithOwner();

    return {
      repository: container.resolve(HardwareRequestRepository).unscoped("gpu-request-claim"),
      email: faker.internet.email().toLowerCase(),
      user,
      organization
    };
  }
});
