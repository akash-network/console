import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { startJobQueues } from "@src/app/providers/jobs.provider";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { JOB_NAME } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { REDACTED } from "@src/feedback/lib/redact-secrets/redact-secrets";
import { AssistantConsentRepository } from "@src/feedback/repositories/assistant-consent/assistant-consent.repository";
import { AssistantConversationRepository } from "@src/feedback/repositories/assistant-conversation/assistant-conversation.repository";
import { FeedbackSubmissionRepository } from "@src/feedback/repositories/feedback-submission/feedback-submission.repository";
import { FeedbackThemeRepository } from "@src/feedback/repositories/feedback-theme/feedback-theme.repository";
import { ClassifyFeedback } from "@src/feedback/services/classify-feedback/classify-feedback.handler";
import { app } from "@src/rest-app";
import { UserRepository } from "@src/user/repositories/user/user.repository";

import { seedAssistantConsent, seedAssistantConversation, seedFeedbackSubmission, seedFeedbackTheme } from "@test/seeders/db/feedback.seeder";
import { findJobRows } from "@test/services/job-queue-harness";

const FAKE_TOKEN = `ghp_${"Z9y8X7w6V5".repeat(3)}`;

describe("Feedback and assistant privacy", () => {
  const userRepository = container.resolve(UserRepository);
  const userAuthTokenService = container.resolve(UserAuthTokenService);
  const feedbackSubmissionRepository = container.resolve(FeedbackSubmissionRepository);
  const assistantConsentRepository = container.resolve(AssistantConsentRepository);
  const assistantConversationRepository = container.resolve(AssistantConversationRepository);
  const feedbackThemeRepository = container.resolve(FeedbackThemeRepository);

  beforeAll(async () => {
    await startJobQueues();
  }, 20_000);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await container.dispose();
  });

  describe("POST /v1/feedback", () => {
    it("returns 401 when the user is not authenticated", async () => {
      await setup();

      const response = await request("POST", "/v1/feedback", undefined, { kind: "general", category: "bug", message: "broken" });

      expect(response.status).toBe(401);
    });

    it("returns 404 while the feature flag is off", async () => {
      const { token } = await setup({ flagOn: false });

      const response = await request("POST", "/v1/feedback", token, { kind: "general", category: "bug", message: "broken" });

      expect(response.status).toBe(404);
    });

    it("stores a deployment outcome rating with its redacted text and context and queues its classification", async () => {
      const { user, token } = await setup();

      const response = await request("POST", "/v1/feedback", token, {
        kind: "deployment_outcome",
        dseq: "21434557",
        outcome: "failed",
        rating: 2,
        message: `It failed with ${FAKE_TOKEN}`,
        failureReason: "no bids",
        page: "/deployments/21434557"
      });
      const { data } = (await response.json()) as { data: { id: string; createdAt: string } };

      expect(response.status).toBe(201);
      expect(await feedbackSubmissionRepository.findById(data.id)).toMatchObject({
        userId: user.id,
        kind: "deployment_outcome",
        dseq: "21434557",
        outcome: "failed",
        dismissed: false,
        rating: 2,
        message: `It failed with ${REDACTED}`,
        context: { isTrialing: null, failureReason: "no bids", page: "/deployments/21434557" },
        classifiedAt: null,
        createdAt: new Date(data.createdAt)
      });
      expect(await findJobRows(ClassifyFeedback[JOB_NAME], { data: { feedbackSubmissionId: data.id } })).toHaveLength(1);
    });

    it("stores general feedback", async () => {
      const { user, token } = await setup();

      const response = await request("POST", "/v1/feedback", token, { kind: "general", category: "feature_request", message: "Add ARM templates" });
      const { data } = (await response.json()) as { data: { id: string } };

      expect(response.status).toBe(201);
      expect(await feedbackSubmissionRepository.findById(data.id)).toMatchObject({
        userId: user.id,
        kind: "general",
        category: "feature_request",
        message: "Add ARM templates",
        dseq: null,
        rating: null
      });
    });

    it("refuses a second answer for the same deployment, including after a dismissal", async () => {
      const { token } = await setup();
      await request("POST", "/v1/feedback", token, { kind: "deployment_outcome", dseq: "9", outcome: "live", dismissed: true });

      const response = await request("POST", "/v1/feedback", token, { kind: "deployment_outcome", dseq: "9", outcome: "live", rating: 5 });

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: "feedback_already_answered" });
    });

    it.each([
      { case: "a rating above 5", body: { kind: "deployment_outcome", dseq: "1", outcome: "live", rating: 6 } },
      { case: "a rating below 1", body: { kind: "deployment_outcome", dseq: "1", outcome: "live", rating: 0 } },
      { case: "a rated outcome without a rating", body: { kind: "deployment_outcome", dseq: "1", outcome: "live" } },
      { case: "a dismissed outcome with a rating", body: { kind: "deployment_outcome", dseq: "1", outcome: "live", dismissed: true, rating: 3 } },
      { case: "a dismissed outcome with a message", body: { kind: "deployment_outcome", dseq: "1", outcome: "live", dismissed: true, message: "hi" } },
      { case: "a dseq that is not a number", body: { kind: "deployment_outcome", dseq: "abc", outcome: "live", rating: 3 } },
      { case: "an unknown outcome", body: { kind: "deployment_outcome", dseq: "1", outcome: "pending", rating: 3 } },
      { case: "general feedback without a message", body: { kind: "general", category: "bug", message: "   " } },
      { case: "general feedback with an unknown category", body: { kind: "general", category: "praise", message: "nice" } },
      { case: "a message over 4000 characters", body: { kind: "general", category: "bug", message: "a".repeat(4001) } },
      { case: "an unknown kind", body: { kind: "survey", message: "hi" } }
    ])("returns 400 for $case", async ({ body }) => {
      const { token } = await setup();

      const response = await request("POST", "/v1/feedback", token, body);

      expect(response.status).toBe(400);
    });
  });

  describe("GET /v1/feedback/outcome-prompts/{dseq}", () => {
    it("returns 401 when the user is not authenticated", async () => {
      await setup();

      expect((await request("GET", "/v1/feedback/outcome-prompts/1")).status).toBe(401);
    });

    it("offers the prompt to a user who never answered one", async () => {
      const { token } = await setup();

      const response = await request("GET", "/v1/feedback/outcome-prompts/42", token);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ data: { dseq: "42", eligible: true, reason: null } });
    });

    it("holds the prompt back for a deployment already answered, and for others during the cooldown", async () => {
      const { user, token } = await setup();
      await seedFeedbackSubmission({ userId: user.id, dseq: "42" });

      expect(await (await request("GET", "/v1/feedback/outcome-prompts/42", token)).json()).toEqual({
        data: { dseq: "42", eligible: false, reason: "already_answered" }
      });
      expect(await (await request("GET", "/v1/feedback/outcome-prompts/43", token)).json()).toEqual({
        data: { dseq: "43", eligible: false, reason: "cooldown" }
      });
    });

    it("ignores other users' answers", async () => {
      const { token } = await setup();
      const stranger = await setup();
      await seedFeedbackSubmission({ userId: stranger.user.id, dseq: "42" });

      expect(await (await request("GET", "/v1/feedback/outcome-prompts/42", token)).json()).toEqual({ data: { dseq: "42", eligible: true, reason: null } });
    });
  });

  describe("GET /v1/assistant/consent", () => {
    it("returns 401 when the user is not authenticated", async () => {
      await setup();

      expect((await request("GET", "/v1/assistant/consent")).status).toBe(401);
    });

    it("answers no consent for a user who never agreed", async () => {
      const { token } = await setup();

      const response = await request("GET", "/v1/assistant/consent", token);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ data: { consent: null, storedConversationCount: 0 } });
    });

    it("answers the latest consent and how many conversations are stored", async () => {
      const { user, token } = await setup();
      const acceptedAt = new Date("2026-10-01T00:00:00.000Z");
      await seedAssistantConsent({ userId: user.id, copyVersion: "v1", processingAcceptedAt: acceptedAt, createdAt: acceptedAt });
      await seedAssistantConsent({
        userId: user.id,
        copyVersion: "v1",
        processingAcceptedAt: acceptedAt,
        reviewOptIn: true,
        createdAt: new Date("2026-10-02T00:00:00.000Z")
      });
      await seedAssistantConversation({ userId: user.id });

      expect(await (await request("GET", "/v1/assistant/consent", token)).json()).toEqual({
        data: {
          consent: { copyVersion: "v1", processingAcceptedAt: acceptedAt.toISOString(), reviewOptIn: true, updatedAt: "2026-10-02T00:00:00.000Z" },
          storedConversationCount: 1
        }
      });
    });
  });

  describe("PUT /v1/assistant/consent", () => {
    it("returns 401 when the user is not authenticated", async () => {
      await setup();

      expect((await request("PUT", "/v1/assistant/consent", undefined, { copyVersion: "v1", reviewOptIn: false })).status).toBe(401);
    });

    it("records each change as a new row and keeps the agreement date while the copy version stays", async () => {
      const { user, token } = await setup();

      const agreed = await request("PUT", "/v1/assistant/consent", token, { copyVersion: "v1", reviewOptIn: false });
      const { data: first } = (await agreed.json()) as { data: { consent: { processingAcceptedAt: string } } };
      const optedIn = await request("PUT", "/v1/assistant/consent", token, { copyVersion: "v1", reviewOptIn: true });

      expect(agreed.status).toBe(200);
      expect(await optedIn.json()).toMatchObject({
        data: { consent: { copyVersion: "v1", reviewOptIn: true, processingAcceptedAt: first.consent.processingAcceptedAt } }
      });
      expect(await assistantConsentRepository.count({ userId: user.id })).toBe(2);
    });

    it.each([
      { case: "an empty copy version", body: { copyVersion: " ", reviewOptIn: false } },
      { case: "a missing opt-in", body: { copyVersion: "v1" } }
    ])("returns 400 for $case", async ({ body }) => {
      const { token } = await setup();

      expect((await request("PUT", "/v1/assistant/consent", token, body)).status).toBe(400);
    });
  });

  describe("DELETE /v1/assistant/conversations", () => {
    it("returns 401 when the user is not authenticated", async () => {
      await setup();

      expect((await request("DELETE", "/v1/assistant/conversations")).status).toBe(401);
    });

    it("deletes the user's conversations, recounts the themes they fed and leaves other users' conversations", async () => {
      const { user, token } = await setup();
      const stranger = await setup();
      const theme = await seedFeedbackTheme({ itemCount: 3, distinctUserCount: 2 });
      await seedAssistantConversation({ userId: user.id, themeId: theme.id });
      await seedAssistantConversation({ userId: user.id });
      await seedAssistantConversation({ userId: stranger.user.id, themeId: theme.id });

      const response = await request("DELETE", "/v1/assistant/conversations", token);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ data: { deletedCount: 2 } });
      expect(await assistantConversationRepository.count({ userId: user.id })).toBe(0);
      expect(await assistantConversationRepository.count({ userId: stranger.user.id })).toBe(1);
      expect(await feedbackThemeRepository.findById(theme.id)).toMatchObject({ itemCount: 1, distinctUserCount: 1 });
    });
  });

  async function request(method: string, path: string, token?: string, data?: Record<string, unknown>) {
    return await app.request(path, {
      method,
      headers: { "Content-Type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      ...(data ? { body: JSON.stringify({ data }) } : {})
    });
  }

  async function setup(input: { flagOn?: boolean } = {}) {
    const user = await userRepository.create({ userId: faker.string.uuid(), username: `user-${faker.string.alphanumeric(12)}`, email: faker.internet.email() });
    const token = faker.string.alphanumeric(40);

    const otherTokens = vi.isMockFunction(userAuthTokenService.getValidUserId)
      ? vi.mocked(userAuthTokenService.getValidUserId).getMockImplementation()
      : undefined;

    vi.spyOn(userAuthTokenService, "getValidUserId").mockImplementation(async header =>
      header.replace(/^Bearer +/i, "") === token ? user.userId! : (await otherTokens?.(header)) ?? null
    );
    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockImplementation(
      flag => flag === FeatureFlags.USER_FEEDBACK_LOOP && input.flagOn !== false
    );

    return { user, token };
  }
});
