import { describe, expect, it } from "vitest";

import { app } from "@src/rest-app";

describe("GET /status", () => {
  it("reports process memory and the registered caches", async () => {
    const response = await app.request("/status");

    expect(response.status).toBe(200);
    const data = (await response.json()) as {
      memory: Record<string, string>;
      caches: Array<{ name: string; entries: number; maxEntries: number; size: string; maxSize: string }>;
    };
    expect(data.memory.rss).toBeDefined();

    const cacheNames = data.caches.map(cache => cache.name);
    expect(cacheNames).toContain("shared");
    expect(cacheNames).toContain("DeploymentReaderService#getDeploymentByOwnerAndDseq");

    const sharedCache = data.caches.find(cache => cache.name === "shared");
    expect(sharedCache).toMatchObject({ entries: expect.any(Number), maxEntries: 500, size: expect.any(String), maxSize: expect.any(String) });
  });
});
