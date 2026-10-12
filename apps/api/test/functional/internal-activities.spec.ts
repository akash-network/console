import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterAll, describe, expect, it } from "vitest";

import { deploymentCloseDedupeKeyOf } from "@src/activity/lib/dedupe-key/dedupe-key";
import { ActivityRepository } from "@src/activity/repositories/activity/activity.repository";
import { CORE_CONFIG } from "@src/core/providers/config.provider";
import { systemClosedActivityOf } from "@src/deployment/utils/close-activity/close-activity";
import { app } from "@src/rest-app";
import { UserRepository } from "@src/user/repositories/user/user.repository";

const PATH = "/internal/activities";

describe("POST /internal/activities", () => {
  const userRepository = container.resolve(UserRepository);
  const activityRepository = container.resolve(ActivityRepository);
  const internalToken = container.resolve(CORE_CONFIG).INTERNAL_API_TOKEN;

  afterAll(async () => {
    await container.dispose();
  });

  it("rejects a caller with no token and writes nothing", async () => {
    const { user, alertFor } = await setup();

    const response = await addAlert(alertFor(), { token: undefined });

    expect(response.status).toBe(401);
    expect(await activityRepository.find({ userId: user.id })).toEqual([]);
  });

  it("rejects a caller with the wrong token and writes nothing", async () => {
    const { user, alertFor } = await setup();

    const response = await addAlert(alertFor(), { token: faker.string.alphanumeric(32) });

    expect(response.status).toBe(401);
    expect(await activityRepository.find({ userId: user.id })).toEqual([]);
  });

  it("adds the alert to the user's feed as an unseen info entry written by Console", async () => {
    const { user, alertFor } = await setup();
    const alert = alertFor({ type: "deployment_reclaim_alert", meta: { dseq: "4242" } });

    const response = await addAlert(alert);

    expect(response.status).toBe(204);
    expect(await activityRepository.find({ userId: user.id })).toEqual([
      expect.objectContaining({
        type: "deployment_reclaim_alert",
        status: "info",
        initiator: "system",
        meta: { alertId: alert.meta.alertId, summary: alert.meta.summary, dseq: "4242" },
        dedupeKey: alert.dedupeKey,
        seenAt: null
      })
    ]);
  });

  it("keeps one entry when the same alert is sent again", async () => {
    const { user, alertFor } = await setup();
    const alert = alertFor();

    const first = await addAlert(alert);
    const repeat = await addAlert(alert);

    expect([first.status, repeat.status]).toEqual([204, 204]);
    expect(await activityRepository.find({ userId: user.id })).toHaveLength(1);
  });

  it("keeps one entry when the same alert arrives twice at once", async () => {
    const { user, alertFor } = await setup();
    const alert = alertFor();

    const responses = await Promise.all([addAlert(alert), addAlert(alert)]);

    expect(responses.map(response => response.status)).toEqual([204, 204]);
    expect(await activityRepository.find({ userId: user.id })).toHaveLength(1);
  });

  it("leaves the close of a deployment as its only entry when its deployment-closed alert arrives", async () => {
    const { user, alertFor } = await setup();
    const close = await activityRepository.create(systemClosedActivityOf({ userId: user.id, dseq: "5150", reason: "trial_ended" }));

    const response = await addAlert(alertFor({ type: "deployment_closed_alert", dedupeKey: deploymentCloseDedupeKeyOf("5150"), meta: { dseq: "5150" } }));

    expect(response.status).toBe(204);
    expect(await activityRepository.find({ userId: user.id })).toEqual([close]);
  });

  it("adds an alert whose dedupe key only another user holds", async () => {
    const { user, alertFor } = await setup();
    const stranger = await setup();
    const alert = alertFor();
    await addAlert(stranger.alertFor({ dedupeKey: alert.dedupeKey }));

    const response = await addAlert(alert);

    expect(response.status).toBe(204);
    expect(await activityRepository.find({ userId: user.id })).toEqual([expect.objectContaining({ dedupeKey: alert.dedupeKey })]);
  });

  it("answers 404 for a user console-api does not know", async () => {
    const { alertFor } = await setup();

    const response = await addAlert({ ...alertFor(), userId: faker.string.uuid() });

    expect(response.status).toBe(404);
  });

  it.each([
    ["a user id that is not a uuid", { userId: "user-1" }],
    ["an action type", { type: "deployment_close" }],
    ["a status other than info", { status: "succeeded" }],
    ["an empty dedupe key", { dedupeKey: "" }],
    ["no dedupe key", { dedupeKey: undefined }],
    ["an alert id that is not a uuid", { meta: { alertId: "alert-1", summary: "Low balance" } }],
    ["an empty summary", { meta: { alertId: faker.string.uuid(), summary: "" } }],
    ["an empty dseq", { meta: { alertId: faker.string.uuid(), summary: "Low balance", dseq: "" } }]
  ])("refuses %s through the shared error handler and writes nothing", async (_, invalid) => {
    const { user, alertFor } = await setup();

    const response = await addAlert({ ...alertFor(), ...invalid });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "BadRequestError", code: "validation_error" });
    expect(await activityRepository.find({ userId: user.id })).toEqual([]);
  });

  it("stays out of the unauthenticated internal openapi document", async () => {
    const response = await app.request("/internal/doc");

    expect(response.status).toBe(200);
    expect(JSON.stringify(await response.json())).not.toContain("createAlertActivity");
  });

  async function addAlert(body: Record<string, unknown>, options: { token?: string } = { token: internalToken }) {
    return await app.request(PATH, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(options.token ? { "x-console-internal-token": options.token } : {})
      },
      body: JSON.stringify(body)
    });
  }

  async function setup() {
    const user = await userRepository.create({ userId: faker.string.uuid() });

    function alertFor(overrides: { type?: string; dedupeKey?: string; meta?: { dseq?: string } } = {}) {
      const alertId = faker.string.uuid();

      return {
        userId: user.id,
        type: overrides.type ?? "wallet_balance_alert",
        status: "info",
        dedupeKey: overrides.dedupeKey ?? `${alertId}.${faker.number.int({ min: 1_000_000, max: 9_000_000 })}`,
        meta: { alertId, summary: `Balance below ${faker.number.int({ min: 1, max: 100 })} USD`, ...overrides.meta }
      };
    }

    return { user, alertFor };
  }
});
