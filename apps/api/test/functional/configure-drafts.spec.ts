import { faker } from "@faker-js/faker";
import { subDays, subMinutes } from "date-fns";
import { container } from "tsyringe";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { startJobQueues } from "@src/app/providers/jobs.provider";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { JOB_NAME } from "@src/core";
import { ConfigureDraftRepository } from "@src/deployment/repositories/configure-draft/configure-draft.repository";
import { MAX_CONFIGURE_DRAFTS_PER_USER } from "@src/deployment/services/configure-draft/configure-draft.service";
import {
  CONFIGURE_DRAFT_TTL_DAYS,
  ExpireConfigureDraft,
  expireConfigureDraftKeyFor
} from "@src/deployment/services/expire-configure-draft/expire-configure-draft.handler";
import { app } from "@src/rest-app";
import { UserRepository } from "@src/user/repositories/user/user.repository";

import { findJobRows } from "@test/services/job-queue-harness";

const SDL = "version: '2.0'\nservices:\n  web:\n    image: nginx\n    env:\n      - TOKEN=ac-secret://TOKEN\n";
const CONTENT = {
  sdl: SDL,
  startingSdl: SDL,
  name: "web",
  runtimeLimitHours: 24,
  inheritSecretsFrom: "1234",
  placementRegions: { dcloud: ["us-east", "eu-west"] }
};

describe("Configure drafts", () => {
  const userRepository = container.resolve(UserRepository);
  const configureDraftRepository = container.resolve(ConfigureDraftRepository);
  const userAuthTokenService = container.resolve(UserAuthTokenService);

  beforeAll(async () => {
    await startJobQueues();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await container.dispose();
  });

  it.each([
    ["GET", undefined],
    ["PUT", CONTENT],
    ["DELETE", undefined]
  ] as const)("returns 401 to a %s from a caller who is not authenticated", async (method, data) => {
    const response = await request(method, "/v1/configure-drafts/draft1", undefined, data);

    expect(response.status).toBe(401);
  });

  it("saves a draft and reads it back", async () => {
    const { token } = await setup();

    const saved = await request("PUT", "/v1/configure-drafts/draft1", token, CONTENT);
    const read = await request("GET", "/v1/configure-drafts/draft1", token);

    expect(saved.status).toBe(200);
    expect(read.status).toBe(200);
    expect(await read.json()).toEqual({ data: { ...CONTENT, draftId: "draft1", updatedAt: expect.any(String) } });
  });

  it("replaces a draft saved again under the same id", async () => {
    const { token } = await setup();
    await request("PUT", "/v1/configure-drafts/draft1", token, CONTENT);

    await request("PUT", "/v1/configure-drafts/draft1", token, { sdl: "version: '2.0'\n" });
    const read = await request("GET", "/v1/configure-drafts/draft1", token);

    expect(await read.json()).toEqual({ data: { sdl: "version: '2.0'\n", draftId: "draft1", updatedAt: expect.any(String) } });
  });

  it("keeps each user's drafts apart even under the same id", async () => {
    const { token } = await setup();
    const stranger = await setup();
    await request("PUT", "/v1/configure-drafts/draft1", stranger.token, { sdl: "stranger's" });

    const before = await request("GET", "/v1/configure-drafts/draft1", token);
    await request("PUT", "/v1/configure-drafts/draft1", token, CONTENT);
    const strangers = await request("GET", "/v1/configure-drafts/draft1", stranger.token);

    expect(before.status).toBe(404);
    expect(((await strangers.json()) as { data: { sdl: string } }).data.sdl).toBe("stranger's");
  });

  it("answers 404 for a draft past its expiry", async () => {
    const { token, user } = await setup();
    await configureDraftRepository.create({
      userId: user.id,
      draftId: "old",
      content: { sdl: SDL },
      updatedAt: subDays(new Date(), CONFIGURE_DRAFT_TTL_DAYS + 1)
    });

    const response = await request("GET", "/v1/configure-drafts/old", token);

    expect(response.status).toBe(404);
  });

  it("schedules a new draft's expiry", async () => {
    const { token, user } = await setup();

    await request("PUT", "/v1/configure-drafts/draft1", token, CONTENT);
    const draft = await configureDraftRepository.findOneBy({ userId: user.id, draftId: "draft1" });
    const jobs = await findJobRows(ExpireConfigureDraft[JOB_NAME], { singletonKey: expireConfigureDraftKeyFor(draft!.id) });

    expect(jobs).toHaveLength(1);
    expect(new Date(jobs[0].start_after).getTime()).toBe(draft!.updatedAt.getTime() + CONFIGURE_DRAFT_TTL_DAYS * 24 * 60 * 60 * 1000);
  });

  it("drops the least recently saved draft once a new one goes past what a user keeps", async () => {
    const { token, user } = await setup();
    for (let index = 0; index < MAX_CONFIGURE_DRAFTS_PER_USER; index++) {
      await configureDraftRepository.create({
        userId: user.id,
        draftId: `kept${index}`,
        content: { sdl: SDL },
        updatedAt: subMinutes(new Date(), MAX_CONFIGURE_DRAFTS_PER_USER - index)
      });
    }

    await request("PUT", "/v1/configure-drafts/newest", token, CONTENT);
    const oldest = await request("GET", "/v1/configure-drafts/kept0", token);
    const next = await request("GET", "/v1/configure-drafts/kept1", token);

    expect(oldest.status).toBe(404);
    expect(next.status).toBe(200);
    expect(await configureDraftRepository.count({ userId: user.id })).toBe(MAX_CONFIGURE_DRAFTS_PER_USER);
  });

  it("deletes a draft, and answers the same for one already gone", async () => {
    const { token } = await setup();
    await request("PUT", "/v1/configure-drafts/draft1", token, CONTENT);

    const deleted = await request("DELETE", "/v1/configure-drafts/draft1", token);
    const again = await request("DELETE", "/v1/configure-drafts/draft1", token);
    const read = await request("GET", "/v1/configure-drafts/draft1", token);

    expect(deleted.status).toBe(204);
    expect(again.status).toBe(204);
    expect(read.status).toBe(404);
  });

  it.each([
    ["an id with characters a draft id never has", "/v1/configure-drafts/not%20an%20id", CONTENT],
    ["an empty sdl", "/v1/configure-drafts/draft1", { ...CONTENT, sdl: "" }],
    ["a runtime limit below an hour", "/v1/configure-drafts/draft1", { ...CONTENT, runtimeLimitHours: 0 }],
    ["a deployment to inherit from that is no dseq", "/v1/configure-drafts/draft1", { ...CONTENT, inheritSecretsFrom: "abc" }]
  ])("refuses %s", async (_case, path, data) => {
    const { token } = await setup();

    const response = await request("PUT", path, token, data);

    expect(response.status).toBe(400);
  });

  async function request(method: "GET" | "PUT" | "DELETE", path: string, token?: string, data?: Record<string, unknown>) {
    return await app.request(path, {
      method,
      headers: { "Content-Type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      ...(data ? { body: JSON.stringify({ data }) } : {})
    });
  }

  async function setup() {
    const user = await userRepository.create({ userId: faker.string.uuid() });
    const token = faker.string.alphanumeric(40);
    const otherTokens = vi.isMockFunction(userAuthTokenService.getValidUserId)
      ? vi.mocked(userAuthTokenService.getValidUserId).getMockImplementation()
      : undefined;

    vi.spyOn(userAuthTokenService, "getValidUserId").mockImplementation(async header =>
      header.replace(/^Bearer +/i, "") === token ? user.userId! : (await otherTokens?.(header)) ?? null
    );

    return { user, token };
  }
});
