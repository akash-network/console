import { readFileSync } from "node:fs";
import path from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

describe("public/sw.js", () => {
  it("takes over from the worker it replaces as soon as it installs", async () => {
    const { dispatch, scope } = setup({ cacheNames: [] });

    await dispatch("install");

    expect(scope.skipWaiting).toHaveBeenCalledTimes(1);
  });

  it("deletes every cache the former worker filled once it activates", async () => {
    const { dispatch, caches } = setup({ cacheNames: ["apis", "next-data", "workbox-precache-v2-https://console.akash.network/"] });

    await dispatch("activate");

    expect(caches.delete.mock.calls.map(([cacheName]) => cacheName)).toEqual(["apis", "next-data", "workbox-precache-v2-https://console.akash.network/"]);
  });

  it("claims open pages and unregisters itself after the caches are gone", async () => {
    const { dispatch, scope, caches } = setup({ cacheNames: ["apis"] });

    await dispatch("activate");

    expect(scope.clients.claim).toHaveBeenCalledTimes(1);
    expect(scope.registration.unregister).toHaveBeenCalledTimes(1);
    expect(caches.delete.mock.invocationCallOrder[0]).toBeLessThan(scope.registration.unregister.mock.invocationCallOrder[0]);
  });

  it("leaves every request to the network", () => {
    const { listeners } = setup({ cacheNames: [] });

    expect([...listeners.keys()]).toEqual(["install", "activate"]);
  });

  function setup(input: { cacheNames: string[] }) {
    const listeners = new Map<string, (event: { waitUntil: (work: Promise<unknown>) => void }) => void>();
    const scope = {
      addEventListener: vi.fn((type: string, listener: (event: { waitUntil: (work: Promise<unknown>) => void }) => void) => listeners.set(type, listener)),
      skipWaiting: vi.fn(() => Promise.resolve()),
      clients: { claim: vi.fn(() => Promise.resolve()) },
      registration: { unregister: vi.fn(() => Promise.resolve(true)) }
    };
    const caches = mock<CacheStorage>({ keys: vi.fn().mockResolvedValue(input.cacheNames), delete: vi.fn().mockResolvedValue(true) });
    runInNewContext(readFileSync(path.join(__dirname, "../public/sw.js"), "utf8"), { self: scope, caches });

    async function dispatch(type: string) {
      const pendingWork: Promise<unknown>[] = [];
      listeners.get(type)?.({ waitUntil: work => pendingWork.push(work) });
      await Promise.all(pendingWork);
    }

    return { dispatch, listeners, scope, caches };
  }
});
