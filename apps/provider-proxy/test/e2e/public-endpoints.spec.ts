import { describe, expect, it } from "vitest";

import { fetchAvailableProviders, fetchProvider, type Provider } from "./setup/fetchProvider";

describe("Provider Proxy API", () => {
  it("can fetch provider /version", async () => {
    const [provider] = await getProviders();
    const response = await fetchProvider(provider, "/version");
    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data).toEqual(
      expect.objectContaining({
        akash: expect.objectContaining({
          name: "provider-services",
          version: expect.any(String),
          commit: expect.any(String),
          cosmos_sdk_version: expect.any(String)
        }),
        kube: expect.objectContaining({
          major: expect.any(String),
          minor: expect.any(String),
          gitCommit: expect.any(String),
          buildDate: expect.any(String)
        })
      })
    );
  });

  it("can fetch provider /status", async () => {
    const [provider] = await getProviders();
    const response = await fetchProvider(provider, "/status");
    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data).toEqual(
      expect.objectContaining({
        address: provider.owner,
        cluster_public_hostname: new URL(provider.hostUri).hostname,
        bidengine: expect.any(Object),
        cluster: expect.objectContaining({
          leases: expect.any(Number),
          inventory: expect.any(Object)
        })
      })
    );
  });

  let providersPromise: Promise<Provider[]> | undefined;
  async function getProviders() {
    providersPromise ??= fetchAvailableProviders();
    return providersPromise;
  }
});
