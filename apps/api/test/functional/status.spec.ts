import { describe, expect, it } from "vitest";

import { app } from "@src/rest-app";

const FUNCTIONAL_TEST_SECRET_TOKEN = "functional-test-secret-token-000000";

describe("GET /status", () => {
  it("reports process memory without listing the registered caches", async () => {
    const response = await app.request("/status");

    expect(response.status).toBe(200);
    const data = (await response.json()) as { memory: Record<string, string>; caches?: unknown };
    expect(data.memory.rss).toBeDefined();
    expect(data.caches).toBeUndefined();
  });
});

describe("GET /status/caches", () => {
  it("rejects a caller without the private token", async () => {
    const response = await app.request("/status/caches");

    expect(response.status).toBe(401);
  });

  it("reports every registered cache with its counts and byte accounting", async () => {
    const response = await app.request(`/status/caches?token=${FUNCTIONAL_TEST_SECRET_TOKEN}`);

    expect(response.status).toBe(200);
    const data = (await response.json()) as {
      caches: Array<{ name: string; entries: number; maxEntries: number; size: string; maxSize: string }>;
    };

    const cacheNames = data.caches.map(cache => cache.name);
    expect(cacheNames).toContain("shared");
    expect(cacheNames).toContain("DeploymentReaderService#getDeploymentByOwnerAndDseq");

    const sharedCache = data.caches.find(cache => cache.name === "shared");
    expect(sharedCache).toMatchObject({ entries: expect.any(Number), maxEntries: 500, size: expect.any(String), maxSize: expect.any(String) });
  });
});
