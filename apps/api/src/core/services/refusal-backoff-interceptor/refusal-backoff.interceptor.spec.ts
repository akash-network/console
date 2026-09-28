import type { LoggerService } from "@akashnetwork/logging";
import { Hono } from "hono";
import { isHttpError } from "http-errors";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { cacheRegistry } from "@src/caching/cache-registry";
import type { CoreConfig } from "@src/core/providers/config.provider";
import { RefusalBackoffInterceptor } from "./refusal-backoff.interceptor";

const USER = "user-a";

describe(RefusalBackoffInterceptor.name, () => {
  it("tells a user to back off once their identical refusals on an endpoint reach the limit", async () => {
    const { send, handler } = setup({ limit: 3, backoffSeconds: 300 });

    await refuse(send, 3);
    const response = await send({ status: 400 });

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("300");
    expect(await response.json()).toEqual({
      message: "This request has been refused repeatedly. Wait before sending it again.",
      code: "repeated_refusal"
    });
    expect(handler).toHaveBeenCalledTimes(3);
  });

  it("keeps counting refusals spread across the window", async () => {
    const { send, advance } = setup({ limit: 3, windowSeconds: 600 });

    await refuse(send, 1);
    advance(599_000);
    await refuse(send, 2);
    const response = await send({ status: 400 });

    expect(response.status).toBe(429);
  });

  it("rounds the wait it announces up to the next whole second", async () => {
    const { send, advance } = setup({ limit: 3, backoffSeconds: 300 });

    await refuse(send, 3);
    advance(1_500);
    const response = await send({ status: 400 });

    expect(response.headers.get("Retry-After")).toBe("299");
  });

  it("lets the request through again once the backoff is over", async () => {
    const { send, advance, handler } = setup({ limit: 3, backoffSeconds: 300 });

    await refuse(send, 3);
    advance(300_000);
    const response = await send({ status: 400 });

    expect(response.status).toBe(400);
    expect(handler).toHaveBeenCalledTimes(4);
  });

  it("counts the refusals after a backoff as a new streak", async () => {
    const { send, advance } = setup({ limit: 3, backoffSeconds: 300 });

    await refuse(send, 3);
    advance(300_000);
    await refuse(send, 2);
    const response = await send({ status: 400 });

    expect(response.status).toBe(400);
  });

  it("forgets the streak once the request succeeds", async () => {
    const { send } = setup({ limit: 3 });

    await refuse(send, 2);
    await send({ status: 200 });
    await refuse(send, 2);
    const response = await send({ status: 400 });

    expect(response.status).toBe(400);
  });

  it.each([200, 302])("never backs off requests that keep answering %s", async status => {
    const { send, handler } = setup({ limit: 3 });

    for (let attempt = 0; attempt < 4; attempt++) {
      await send({ status });
    }

    expect(handler).toHaveBeenCalledTimes(4);
  });

  it("keeps the streak through a failure of ours", async () => {
    const { send } = setup({ limit: 3 });

    await refuse(send, 2);
    await send({ status: 500 });
    await refuse(send, 1);
    const response = await send({ status: 400 });

    expect(response.status).toBe(429);
  });

  it("starts a new streak when the refusal changes", async () => {
    const { send } = setup({ limit: 3 });

    await send({ status: 400 });
    await send({ status: 402 });
    await send({ status: 400 });
    const response = await send({ status: 400 });

    expect(response.status).toBe(400);
  });

  it("starts a new streak once the window has passed", async () => {
    const { send, advance } = setup({ limit: 3, windowSeconds: 600 });

    await refuse(send, 2);
    advance(600_000);
    await refuse(send, 1);
    const response = await send({ status: 400 });

    expect(response.status).toBe(400);
  });

  it("keeps each user's streak apart", async () => {
    const { send } = setup({ limit: 3 });

    await refuse(send, 3);
    const response = await send({ status: 400, userId: "user-b" });

    expect(response.status).toBe(400);
  });

  it("keeps each endpoint's streak apart", async () => {
    const { send } = setup({ limit: 3 });

    await refuse(send, 3);
    const response = await send({ status: 400, path: "/v1/deployments" });

    expect(response.status).toBe(400);
  });

  it("keeps each method's streak apart", async () => {
    const { send } = setup({ limit: 3 });

    await refuse(send, 3);
    const response = await send({ status: 400, method: "DELETE" });

    expect(response.status).toBe(400);
  });

  it.each(["GET", "HEAD", "OPTIONS"])("never backs off a %s request", async method => {
    const { send, handler } = setup({ limit: 3 });

    for (let attempt = 0; attempt < 4; attempt++) {
      await send({ status: 404, method });
    }

    expect(handler).toHaveBeenCalledTimes(4);
  });

  it("never backs off an anonymous request", async () => {
    const { send, handler } = setup({ limit: 3 });

    for (let attempt = 0; attempt < 4; attempt++) {
      await send({ status: 400, userId: null });
    }

    expect(handler).toHaveBeenCalledTimes(4);
  });

  it.each([401, 429])("does not count a %s as a refusal", async status => {
    const { send, handler } = setup({ limit: 3 });

    for (let attempt = 0; attempt < 4; attempt++) {
      await send({ status });
    }

    expect(handler).toHaveBeenCalledTimes(4);
  });

  it("backs off nothing when the limit is 0", async () => {
    const { send, handler } = setup({ limit: 0 });

    for (let attempt = 0; attempt < 4; attempt++) {
      await send({ status: 400 });
    }

    expect(handler).toHaveBeenCalledTimes(4);
  });

  it("logs under its own name", () => {
    const { createLogger } = setup({});

    expect(createLogger).toHaveBeenCalledWith({ context: "RefusalBackoffInterceptor" });
  });

  it("registers its streaks with the cache registry", () => {
    setup({});

    expect(cacheRegistry.getStats().some(stats => stats.name.startsWith("RefusalBackoffInterceptor#streaks"))).toBe(true);
  });

  async function refuse(send: ReturnType<typeof setup>["send"], times: number) {
    for (let attempt = 0; attempt < times; attempt++) {
      await send({ status: 400 });
    }
  }

  function setup(input: { limit?: number; windowSeconds?: number; backoffSeconds?: number }) {
    vi.useFakeTimers({ now: new Date("2026-09-28T12:00:00Z") });
    onTestFinished(() => {
      vi.useRealTimers();
    });

    const config = mock<CoreConfig>({
      REPEATED_REFUSAL_LIMIT: input.limit ?? 3,
      REPEATED_REFUSAL_WINDOW_SECONDS: input.windowSeconds ?? 600,
      REPEATED_REFUSAL_BACKOFF_SECONDS: input.backoffSeconds ?? 300
    });
    const createLogger = vi.fn(() => mock<LoggerService>());
    const interceptor = new RefusalBackoffInterceptor(config, createLogger);
    const handler = vi.fn();

    const app = new Hono<{ Variables: { user?: { id: string } } }>()
      .onError((error, c) => {
        if (isHttpError(error)) {
          return c.json({ message: error.message, code: error.errorCode }, { status: error.status, headers: error.headers });
        }
        throw error;
      })
      .use(async (c, next) => {
        const userId = c.req.header("x-test-user");
        if (userId) c.set("user", { id: userId });
        await next();
      })
      .use(interceptor.intercept())
      .all("*", c => {
        handler();
        return c.body(null, Number(c.req.header("x-respond-with")) as 200);
      });

    return {
      createLogger,
      handler,
      advance: (ms: number) => vi.advanceTimersByTime(ms),
      send: (request: { status: number; method?: string; path?: string; userId?: string | null }) =>
        app.request(request.path ?? "/v1/leases", {
          method: request.method ?? "POST",
          headers: {
            "x-respond-with": String(request.status),
            ...(request.userId === null ? {} : { "x-test-user": request.userId ?? USER })
          }
        })
    };
  }
});
