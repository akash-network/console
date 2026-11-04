import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { HardwareRequestEventRepository } from "./hardware-request-event.repository";

import { seedHardwareRequest } from "@test/seeders/db/hardware-request.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

describe(HardwareRequestEventRepository.name, () => {
  describe("hasRecorded", () => {
    it("matches an event of the same type on the same request whose payload holds every given field", async () => {
      const { repository, hardwareRequest, otherRequest } = await setup();
      await repository.record({
        hardwareRequestId: hardwareRequest.id,
        type: "approval_requested",
        actor: null,
        payload: { offerId: "offer-1", userId: "user-1" }
      });

      const hasRecorded = (hardwareRequestId: string, type: "approval_requested" | "offer_declined", payload: { offerId: string; userId: string }) =>
        repository.hasRecorded({ hardwareRequestId, type, payload });

      await expect(hasRecorded(hardwareRequest.id, "approval_requested", { offerId: "offer-1", userId: "user-1" })).resolves.toBe(true);
      await expect(hasRecorded(hardwareRequest.id, "approval_requested", { offerId: "offer-1", userId: "user-2" })).resolves.toBe(false);
      await expect(hasRecorded(hardwareRequest.id, "approval_requested", { offerId: "offer-2", userId: "user-1" })).resolves.toBe(false);
      await expect(hasRecorded(hardwareRequest.id, "offer_declined", { offerId: "offer-1", userId: "user-1" })).resolves.toBe(false);
      await expect(hasRecorded(otherRequest.id, "approval_requested", { offerId: "offer-1", userId: "user-1" })).resolves.toBe(false);
    });
  });

  async function setup() {
    const user = await seedUser();
    const [hardwareRequest, otherRequest] = await Promise.all([seedHardwareRequest({ userId: user.id }), seedHardwareRequest({ userId: user.id })]);

    return { repository: container.resolve(HardwareRequestEventRepository), hardwareRequest, otherRequest };
  }
});
