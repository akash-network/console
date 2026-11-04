import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import type { HardwareRequestOfferTerms } from "@src/hardware-request/model-schemas";
import { HardwareRequestOfferRepository } from "./hardware-request-offer.repository";

import { seedHardwareRequest } from "@test/seeders/db/hardware-request.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

const TERMS: HardwareRequestOfferTerms = {
  gpu: { model: "H200", count: 16, interconnect: "cluster" },
  location: "Frankfurt, DE",
  availableFrom: "2026-12-01",
  term: "6_months",
  sla: "99.9",
  storage: { tbPerNode: 8, nvme: true },
  uplinkGbps: 10
};

describe(HardwareRequestOfferRepository.name, () => {
  describe("findOldestFirst", () => {
    it("lists a request's offers oldest first, with their times as ISO strings", async () => {
      const { repository, hardwareRequest, otherRequest } = await setup();
      const expiresAt = new Date("2026-12-15T00:00:00.000Z");
      const published = await repository.create({ ...anOffer(hardwareRequest.id), expiresAt, publishedAt: new Date("2026-11-04T00:00:00.000Z") });
      const draft = await repository.create({ ...anOffer(hardwareRequest.id), expiresAt });
      await repository.create({ ...anOffer(otherRequest.id), expiresAt });

      await expect(repository.findOldestFirst(hardwareRequest.id)).resolves.toEqual([
        { ...published, expiresAt: "2026-12-15T00:00:00.000Z", publishedAt: "2026-11-04T00:00:00.000Z", createdAt: expect.any(String) },
        { ...draft, status: "draft", publishedAt: null }
      ]);
    });
  });

  describe("closeOthers", () => {
    it("closes the request's other open offers and leaves settled ones and other requests alone", async () => {
      const { repository, hardwareRequest, otherRequest } = await setup();
      const expiresAt = new Date("2026-12-15T00:00:00.000Z");
      const [accepted, draft, published, declined, elsewhere] = await Promise.all([
        repository.create({ ...anOffer(hardwareRequest.id), expiresAt, status: "accepted" }),
        repository.create({ ...anOffer(hardwareRequest.id), expiresAt, status: "draft" }),
        repository.create({ ...anOffer(hardwareRequest.id), expiresAt, status: "published" }),
        repository.create({ ...anOffer(hardwareRequest.id), expiresAt, status: "declined" }),
        repository.create({ ...anOffer(otherRequest.id), expiresAt, status: "published" })
      ]);

      await repository.closeOthers(hardwareRequest.id, accepted.id);

      const statuses = Object.fromEntries((await repository.findOldestFirst(hardwareRequest.id)).map(offer => [offer.id, offer.status]));
      expect(statuses).toEqual({ [accepted.id]: "accepted", [draft.id]: "closed", [published.id]: "closed", [declined.id]: "declined" });
      expect(await repository.findById(elsewhere.id)).toMatchObject({ status: "published" });
    });
  });

  function anOffer(hardwareRequestId: string) {
    return { hardwareRequestId, providerAddress: "akash1provider", providerAudited: true, providerUptime7d: 0.99, usdPerGpuHour: 2.4, terms: TERMS };
  }

  async function setup() {
    const user = await seedUser();
    const [hardwareRequest, otherRequest] = await Promise.all([seedHardwareRequest({ userId: user.id }), seedHardwareRequest({ userId: user.id })]);

    return { repository: container.resolve(HardwareRequestOfferRepository), hardwareRequest, otherRequest };
  }
});
