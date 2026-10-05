import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import type { ActivityStatus } from "@src/activity/model-schemas";
import { ActivityRepository } from "@src/activity/repositories/activity/activity.repository";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { app } from "@src/rest-app";
import { UserRepository } from "@src/user/repositories/user/user.repository";

type ActivityBody = { id: string; type: string; status: string; meta: Record<string, unknown>; seenAt: string | null; createdAt: string; updatedAt: string };
type PageBody = { data: { activities: ActivityBody[]; unseenCount: number; pagination: { limit: number; hasMore: boolean; nextCursor: string | null } } };

describe("Activities", () => {
  const userRepository = container.resolve(UserRepository);
  const activityRepository = container.resolve(ActivityRepository);
  const userAuthTokenService = container.resolve(UserAuthTokenService);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await container.dispose();
  });

  describe("GET /v1/activities", () => {
    it("returns 401 when the caller is not authenticated", async () => {
      const response = await request("/v1/activities");

      expect(response.status).toBe(401);
    });

    it("lists the caller's activities newest first and nobody else's", async () => {
      const { token, seed } = await setup();
      const stranger = await setup();
      const older = await seed({
        createdAt: new Date("2026-10-05T10:00:00.000Z"),
        status: "failed",
        meta: { dseq: "1001", error: { code: "close_failed", message: "Nope" } }
      });
      const newer = await seed({ createdAt: new Date("2026-10-05T11:00:00.000Z"), meta: { dseq: "1002" } });
      await stranger.seed();

      const response = await request("/v1/activities", token);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        data: {
          activities: [
            {
              id: newer.id,
              type: "deployment_close",
              status: "succeeded",
              meta: { dseq: "1002" },
              seenAt: null,
              createdAt: "2026-10-05T11:00:00.000Z",
              updatedAt: newer.updatedAt
            },
            {
              id: older.id,
              type: "deployment_close",
              status: "failed",
              meta: { dseq: "1001", error: { code: "close_failed", message: "Nope" } },
              seenAt: null,
              createdAt: "2026-10-05T10:00:00.000Z",
              updatedAt: older.updatedAt
            }
          ],
          unseenCount: 2,
          pagination: { limit: 20, hasMore: false, nextCursor: null }
        }
      });
    });

    it("counts every unseen activity of the caller, whatever the page and filters", async () => {
      const { token, seed } = await setup();
      const stranger = await setup();
      await seed({ status: "failed" });
      await seed({ status: "succeeded" });
      await seed({ status: "succeeded", seenAt: new Date() });
      await stranger.seed();

      const response = await request("/v1/activities?limit=1&status=failed", token);
      const { data } = (await response.json()) as PageBody;

      expect(data.unseenCount).toBe(2);
    });

    it("continues from the cursor the previous page returned", async () => {
      const { token, seed } = await setup();
      const older = await seed({ createdAt: new Date("2026-10-05T10:00:00.000Z") });
      await seed({ createdAt: new Date("2026-10-05T11:00:00.000Z") });
      const firstPage = (await (await request("/v1/activities?limit=1", token)).json()) as PageBody;

      const response = await request(`/v1/activities?limit=1&cursor=${firstPage.data.pagination.nextCursor}`, token);
      const { data } = (await response.json()) as PageBody;

      expect(firstPage.data.pagination.hasMore).toBe(true);
      expect(data.activities.map(activity => activity.id)).toEqual([older.id]);
      expect(data.pagination).toEqual({ limit: 1, hasMore: false, nextCursor: null });
    });

    it("keeps only the activities in the status asked for", async () => {
      const { token, seed } = await setup();
      const failed = await seed({ status: "failed" });
      await seed({ status: "succeeded" });

      const response = await request("/v1/activities?status=failed", token);
      const { data } = (await response.json()) as PageBody;

      expect(data.activities.map(activity => activity.id)).toEqual([failed.id]);
    });

    it("refuses a cursor it cannot read", async () => {
      const { token } = await setup();

      const response = await request("/v1/activities?cursor=garbage", token);

      expect(response.status).toBe(400);
    });

    it("refuses a page larger than 100 activities", async () => {
      const { token } = await setup();

      const response = await request("/v1/activities?limit=101", token);

      expect(response.status).toBe(400);
    });
  });

  describe("GET /v1/activities/{id}", () => {
    it("returns one of the caller's activities", async () => {
      const { token, seed } = await setup();
      const activity = await seed({ status: "pending", createdAt: new Date("2026-10-05T10:00:00.000Z"), meta: { dseq: "1001" } });

      const response = await request(`/v1/activities/${activity.id}`, token);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        data: {
          id: activity.id,
          type: "deployment_close",
          status: "pending",
          meta: { dseq: "1001" },
          seenAt: null,
          createdAt: "2026-10-05T10:00:00.000Z",
          updatedAt: activity.updatedAt
        }
      });
    });

    it("answers 404 for another user's activity, the same as for one that does not exist", async () => {
      const { token } = await setup();
      const stranger = await setup();
      const strangers = await stranger.seed();

      const response = await request(`/v1/activities/${strangers.id}`, token);

      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({ message: "Activity not found" });
    });

    it("refuses an id that is not a uuid", async () => {
      const { token } = await setup();

      const response = await request("/v1/activities/42", token);

      expect(response.status).toBe(400);
    });
  });

  describe("POST /v1/activities/seen", () => {
    it("marks the chosen activities seen and answers with how many are still unseen", async () => {
      const { token, seed } = await setup();
      const chosen = await seed();
      const other = await seed();

      const response = await request("/v1/activities/seen", token, { ids: [chosen.id] });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ data: { unseenCount: 1 } });
      expect((await activityRepository.findById(chosen.id))?.seenAt).toEqual(expect.any(String));
      expect((await activityRepository.findById(other.id))?.seenAt).toBeNull();
    });

    it("marks every activity created up to the time given", async () => {
      const { token, seed } = await setup();
      await seed({ createdAt: new Date("2026-10-05T10:00:00.000Z") });
      const later = await seed({ createdAt: new Date("2026-10-05T12:00:00.000Z") });

      const response = await request("/v1/activities/seen", token, { upTo: "2026-10-05T11:00:00.000Z" });

      expect(await response.json()).toEqual({ data: { unseenCount: 1 } });
      expect((await activityRepository.findById(later.id))?.seenAt).toBeNull();
    });

    it("leaves another user's activities unseen even when their ids are named", async () => {
      const { token } = await setup();
      const stranger = await setup();
      const strangers = await stranger.seed();

      await request("/v1/activities/seen", token, { ids: [strangers.id] });

      expect((await activityRepository.findById(strangers.id))?.seenAt).toBeNull();
    });

    it("refuses a request that names neither ids nor a time", async () => {
      const { token } = await setup();

      const response = await request("/v1/activities/seen", token, {});

      expect(response.status).toBe(400);
    });
  });

  async function request(path: string, token?: string, data?: Record<string, unknown>) {
    return await app.request(path, {
      method: data ? "POST" : "GET",
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

    async function seed(overrides: { status?: ActivityStatus; createdAt?: Date; seenAt?: Date; meta?: Record<string, unknown> } = {}) {
      return await activityRepository.create({
        userId: user.id,
        type: "deployment_close",
        status: "succeeded",
        meta: { dseq: faker.string.numeric(6) },
        ...overrides
      });
    }

    return { user, token, seed };
  }
});
