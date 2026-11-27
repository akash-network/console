import { faker } from "@faker-js/faker";
import nock from "nock";
import { container } from "tsyringe";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { startJobQueues } from "@src/app/providers/jobs.provider";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { ActivateTrial } from "@src/billing/events/activate-trial";
import { JOB_NAME } from "@src/core";
import { app } from "@src/rest-app";
import { UserRepository } from "@src/user/repositories/user/user.repository";
import { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";

import { findJobRows } from "@test/services/job-queue-harness";

const STRIPE_ORIGIN = "https://api.stripe.com";

describe("Trial card", () => {
  const userRepository = container.resolve(UserRepository);
  const userAuthTokenService = container.resolve(UserAuthTokenService);

  beforeAll(async () => {
    await startJobQueues();
  }, 20_000);

  afterEach(() => {
    vi.restoreAllMocks();
    nock.cleanAll();
  });

  afterAll(async () => {
    await container.dispose();
  });

  describe("GET /v1/trial-card", () => {
    it("asks an account whose trial is held for a card", async () => {
      const { signUp, getTrialCard } = setup();
      const account = await signUp({ isHeld: true });

      const response = await getTrialCard(account.token);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ data: { step: "required" } });
    });

    it("asks nothing of an account nothing holds", async () => {
      const { signUp, getTrialCard } = setup();
      const account = await signUp({ isHeld: false });

      const response = await getTrialCard(account.token);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ data: { step: "not_required" } });
    });

    it("asks nothing of a held account while the card step is off", async () => {
      const { signUp, getTrialCard } = setup({ cardStep: "off" });
      const account = await signUp({ isHeld: true });

      const response = await getTrialCard(account.token);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ data: { step: "not_required" } });
    });

    it("answers 401 without a token", async () => {
      const response = await app.request("/v1/trial-card");

      expect(response.status).toBe(401);
    });
  });

  describe("POST /v1/trial-card/setup-intents", () => {
    it("creates a card-only setup intent for the caller's customer that asks for 3D Secure", async () => {
      const { signUp, createSetupIntent } = setup();
      const account = await signUp({ isHeld: true });
      const requestBodies: string[] = [];
      nock(STRIPE_ORIGIN)
        .post("/v1/setup_intents", body => requestBodies.push(new URLSearchParams(body).toString()) > 0)
        .reply(200, { id: "seti_created", object: "setup_intent", client_secret: "seti_created_secret" });

      const response = await createSetupIntent(account.token);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ data: { id: "seti_created", clientSecret: "seti_created_secret" } });
      const sent = new URLSearchParams(requestBodies[0]);
      expect(sent.get("customer")).toBe(account.stripeCustomerId);
      expect(sent.getAll("payment_method_types[0]")).toEqual(["card"]);
      expect(sent.get("payment_method_types[1]")).toBeNull();
      expect(sent.get("payment_method_options[card][request_three_d_secure]")).toBe("any");
      expect(sent.get("metadata[trial_card]")).toBe("true");
    });

    it("answers 404 without calling Stripe while the card step is off", async () => {
      const { signUp, createSetupIntent } = setup({ cardStep: "off" });
      const account = await signUp({ isHeld: true });
      const stripeScope = nock(STRIPE_ORIGIN).post("/v1/setup_intents").reply(200, {});

      const response = await createSetupIntent(account.token);

      expect(response.status).toBe(404);
      expect(stripeScope.isDone()).toBe(false);
    });
  });

  describe("POST /v1/trial-card/confirm", () => {
    it("verifies the card, queues the trial once and reports the card step as verified", async () => {
      const { signUp, saveCard, confirmTrialCard, getTrialCard } = setup();
      const account = await signUp({ isHeld: true });
      const setupIntentId = saveCard(account, { fingerprint: `fp_${faker.string.alphanumeric(16)}` });

      const response = await confirmTrialCard(account.token, { data: { setupIntentId } });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ data: { step: "verified" } });
      expect(await findJobRows(ActivateTrial[JOB_NAME], { singletonKey: `ActivateTrial.${account.id}` })).toHaveLength(1);
      expect(await (await getTrialCard(account.token)).json()).toEqual({ data: { step: "verified" } });
    });

    it("answers 422 for a card that already started another account's trial, and queues no trial", async () => {
      const { signUp, saveCard, confirmTrialCard, getTrialCard } = setup();
      const fingerprint = `fp_${faker.string.alphanumeric(16)}`;
      const first = await signUp({ isHeld: true });
      const second = await signUp({ isHeld: true });
      await confirmTrialCard(first.token, { data: { setupIntentId: saveCard(first, { fingerprint }) } });

      const response = await confirmTrialCard(second.token, { data: { setupIntentId: saveCard(second, { fingerprint }) } });

      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({
        code: "trial_card_already_used",
        message: "This card has already started a free trial. You can still add credits to deploy."
      });
      expect(await findJobRows(ActivateTrial[JOB_NAME], { singletonKey: `ActivateTrial.${second.id}` })).toEqual([]);
      expect(await (await getTrialCard(second.token)).json()).toEqual({ data: { step: "required" } });
    });

    it("answers 422 for a prepaid card", async () => {
      const { signUp, saveCard, confirmTrialCard } = setup();
      const account = await signUp({ isHeld: true });
      const setupIntentId = saveCard(account, { fingerprint: `fp_${faker.string.alphanumeric(16)}`, funding: "prepaid" });

      const response = await confirmTrialCard(account.token, { data: { setupIntentId } });

      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({ code: "trial_card_prepaid" });
    });

    it("answers 422 for a card whose setup intent has not succeeded", async () => {
      const { signUp, saveCard, confirmTrialCard } = setup();
      const account = await signUp({ isHeld: true });
      const setupIntentId = saveCard(account, { fingerprint: `fp_${faker.string.alphanumeric(16)}`, status: "requires_action" });

      const response = await confirmTrialCard(account.token, { data: { setupIntentId } });

      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({ code: "trial_card_not_verified" });
    });

    it("answers 404 for a setup intent of another customer, and for one Stripe does not know", async () => {
      const { signUp, saveCard, confirmTrialCard } = setup();
      const account = await signUp({ isHeld: true });
      const other = await signUp({ isHeld: true });
      const othersSetupIntentId = saveCard(other, { fingerprint: `fp_${faker.string.alphanumeric(16)}` });
      const unknownSetupIntentId = `seti_${faker.string.alphanumeric(24)}`;
      nock(STRIPE_ORIGIN)
        .get(`/v1/setup_intents/${unknownSetupIntentId}`)
        .query(true)
        .reply(404, { error: { type: "invalid_request_error", code: "resource_missing", message: "No such setupintent" } });

      const othersResponse = await confirmTrialCard(account.token, { data: { setupIntentId: othersSetupIntentId } });
      const unknownResponse = await confirmTrialCard(account.token, { data: { setupIntentId: unknownSetupIntentId } });

      expect(othersResponse.status).toBe(404);
      expect(unknownResponse.status).toBe(404);
      expect(await findJobRows(ActivateTrial[JOB_NAME], { singletonKey: `ActivateTrial.${account.id}` })).toEqual([]);
    });

    it("answers 404 without calling Stripe while the card step is off", async () => {
      const { signUp, saveCard, confirmTrialCard } = setup({ cardStep: "off" });
      const account = await signUp({ isHeld: true });
      const setupIntentId = saveCard(account, { fingerprint: `fp_${faker.string.alphanumeric(16)}` });

      const response = await confirmTrialCard(account.token, { data: { setupIntentId } });

      expect(response.status).toBe(404);
      expect(nock.pendingMocks()).toHaveLength(1);
    });

    it("answers 400 for a request without a setup intent id", async () => {
      const { signUp, confirmTrialCard } = setup();
      const account = await signUp({ isHeld: true });

      const response = await confirmTrialCard(account.token, { data: {} });

      expect(response.status).toBe(400);
    });
  });

  function setup(input: { cardStep?: "off" | "on" } = {}) {
    const workloadAbuseConfig = container.resolve(WorkloadAbuseConfigService);
    const readWorkloadAbuseConfig = workloadAbuseConfig.get.bind(workloadAbuseConfig);
    const overrides: Partial<Record<Parameters<typeof readWorkloadAbuseConfig>[0], unknown>> = {
      WORKLOAD_ABUSE_SIGNUP_HOLD_MODE: "off",
      WORKLOAD_ABUSE_GENERATED_EMAIL_TAG_HOLD_MODE: "enforce",
      WORKLOAD_ABUSE_REFUSED_SIGNUP_HOLD_MODE: "off",
      WORKLOAD_ABUSE_EMAIL_DOMAIN_HOLD_MODE: "off",
      WORKLOAD_ABUSE_NEW_EMAIL_DOMAIN_HOLD_MODE: "off",
      WORKLOAD_ABUSE_HELD_TRIAL_CARD_STEP: input.cardStep ?? "on"
    };
    vi.spyOn(workloadAbuseConfig, "get").mockImplementation((key =>
      key in overrides ? overrides[key] : readWorkloadAbuseConfig(key)) as typeof workloadAbuseConfig.get);

    const tokens = new Map<string, string>();
    vi.spyOn(userAuthTokenService, "getValidUserId").mockImplementation(async received => tokens.get(received.replace(/^Bearer +/i, "")) ?? null);

    const request = (path: string, token: string, body?: unknown) =>
      app.request(path, {
        method: body === undefined ? "GET" : "POST",
        headers: new Headers({ authorization: `Bearer ${token}`, "content-type": "application/json" }),
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
      });

    return {
      signUp: async ({ isHeld }: { isHeld: boolean }) => {
        const mailbox = faker.string.alpha(10).toLowerCase();
        const generatedTag = `${faker.string.alpha(4)}${faker.string.numeric(4)}`.toLowerCase();
        const user = await userRepository.create({
          userId: faker.string.uuid(),
          email: isHeld ? `${mailbox}+${generatedTag}@example.com` : `${mailbox}@example.com`,
          emailVerified: true,
          stripeCustomerId: `cus_${faker.string.alphanumeric(14)}`
        });
        const token = faker.string.alphanumeric(40);
        tokens.set(token, user.userId!);

        return { id: user.id, token, stripeCustomerId: user.stripeCustomerId! };
      },
      saveCard: (account: { stripeCustomerId: string }, card: { fingerprint: string; funding?: string; status?: string }) => {
        const setupIntentId = `seti_${faker.string.alphanumeric(24)}`;
        nock(STRIPE_ORIGIN)
          .get(`/v1/setup_intents/${setupIntentId}`)
          .query({ expand: ["payment_method"] })
          .reply(200, {
            id: setupIntentId,
            object: "setup_intent",
            status: card.status ?? "succeeded",
            customer: account.stripeCustomerId,
            metadata: { trial_card: "true" },
            payment_method: {
              id: `pm_${faker.string.alphanumeric(24)}`,
              object: "payment_method",
              type: "card",
              card: { brand: "visa", last4: "4242", fingerprint: card.fingerprint, funding: card.funding ?? "credit" }
            }
          });

        return setupIntentId;
      },
      getTrialCard: (token: string) => request("/v1/trial-card", token),
      createSetupIntent: (token: string) => request("/v1/trial-card/setup-intents", token, {}),
      confirmTrialCard: (token: string, body: unknown) => request("/v1/trial-card/confirm", token, body)
    };
  }
});
