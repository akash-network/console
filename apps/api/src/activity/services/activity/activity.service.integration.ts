import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { deploymentCloseDedupeKeyOf } from "@src/activity/lib/dedupe-key/dedupe-key";
import type { AlertActivityType } from "@src/activity/model-schemas";
import { ActivityRepository } from "@src/activity/repositories/activity/activity.repository";
import { closedActivityOf, systemClosedActivityOf } from "@src/deployment/utils/close-activity/close-activity";
import { UserRepository } from "@src/user/repositories/user/user.repository";
import { ActivityService } from "./activity.service";

describe(ActivityService.name, () => {
  describe("when a deployment closes and its deployment-closed alert fires", () => {
    it("shows the close once when the alert arrives first", async () => {
      const { service, createUser, closedAlertOf, findActivities } = setup();
      const userId = await createUser();

      await service.addAlert(closedAlertOf(userId, "1001"));
      await service.record(systemClosedActivityOf({ userId, dseq: "1001", reason: "trial_ended" }));

      expect(await findActivities(userId)).toEqual([
        expect.objectContaining({
          type: "deployment_close",
          status: "succeeded",
          initiator: "system",
          meta: { dseq: "1001", reason: "trial_ended" },
          dedupeKey: deploymentCloseDedupeKeyOf("1001")
        })
      ]);
    });

    it("shows the close once when the close arrives first", async () => {
      const { service, createUser, closedAlertOf, findActivities } = setup();
      const userId = await createUser();

      await service.record(closedActivityOf({ userId, dseq: "1001" }));
      await service.addAlert(closedAlertOf(userId, "1001"));

      expect(await findActivities(userId)).toEqual([
        expect.objectContaining({ type: "deployment_close", status: "succeeded", initiator: "user", dedupeKey: deploymentCloseDedupeKeyOf("1001") })
      ]);
    });

    it("shows the close once when a close that gave up settles as closed after the alert arrived", async () => {
      const { service, repository, createUser, closedAlertOf, findActivities } = setup();
      const userId = await createUser();
      const gaveUp = await repository.create({ userId, type: "deployment_close", status: "failed", meta: { dseq: "1001" } });

      await service.addAlert(closedAlertOf(userId, "1001"));
      await service.settle(gaveUp.id, closedActivityOf({ userId, dseq: "1001" }), { from: ["pending", "failed"] });

      expect(await findActivities(userId)).toEqual([
        expect.objectContaining({ id: gaveUp.id, type: "deployment_close", status: "succeeded", dedupeKey: deploymentCloseDedupeKeyOf("1001") })
      ]);
    });

    it("keeps the alert when a settle finds the close it reports already settled", async () => {
      const { service, repository, createUser, closedAlertOf, findActivities } = setup();
      const userId = await createUser();
      const gaveUp = await repository.create({ userId, type: "deployment_close", status: "failed", meta: { dseq: "1001" } });

      await service.addAlert(closedAlertOf(userId, "1001"));
      await service.settle(gaveUp.id, closedActivityOf({ userId, dseq: "1001" }));

      expect(await findActivities(userId)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: gaveUp.id, status: "failed", dedupeKey: null }),
          expect.objectContaining({ type: "deployment_closed_alert", dedupeKey: deploymentCloseDedupeKeyOf("1001") })
        ])
      );
    });

    it("leaves every alert about another deployment, another user or another kind in place", async () => {
      const { service, createUser, closedAlertOf, findActivities } = setup();
      const userId = await createUser();
      const strangerId = await createUser();
      await service.addAlert(closedAlertOf(userId, "2002"));
      await service.addAlert(closedAlertOf(strangerId, "1001"));
      await service.addAlert({
        ...closedAlertOf(userId, "1001"),
        type: "deployment_reclaim_alert",
        dedupeKey: `deployment_reclaim_alert.${faker.string.uuid()}`
      });

      await service.record(closedActivityOf({ userId, dseq: "1001" }));

      expect((await findActivities(userId)).map(activity => activity.type).sort()).toEqual([
        "deployment_close",
        "deployment_closed_alert",
        "deployment_reclaim_alert"
      ]);
      expect(await findActivities(strangerId)).toEqual([expect.objectContaining({ type: "deployment_closed_alert" })]);
    });
  });

  function setup() {
    const service = container.resolve(ActivityService);
    const repository = container.resolve(ActivityRepository);
    const userRepository = container.resolve(UserRepository);

    async function createUser() {
      return (await userRepository.create({ userId: faker.string.uuid() })).id;
    }

    function closedAlertOf(userId: string, dseq: string) {
      return {
        userId,
        type: "deployment_closed_alert" as AlertActivityType,
        status: "info" as const,
        meta: { alertId: faker.string.uuid(), summary: `Deployment ${dseq} is now closed`, dseq },
        dedupeKey: deploymentCloseDedupeKeyOf(dseq)
      };
    }

    async function findActivities(userId: string) {
      return await repository.find({ userId });
    }

    return { service, repository, createUser, closedAlertOf, findActivities };
  }
});
