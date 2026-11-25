import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { describeComparableShapes } from "./setup/describeComparableShapes";
import { fetchAvailableProviders, fetchProvider, type Provider } from "./setup/fetchProvider";

const PROVIDER_LIST_TIMEOUT_MS = 30_000;

describe("Provider Proxy API", () => {
  let providers: Provider[];

  beforeAll(async () => {
    providers = await fetchAvailableProviders();
  }, PROVIDER_LIST_TIMEOUT_MS);

  beforeAll(() => {
    // ensure that tests can run against providers with self-signed certificates
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  });

  afterAll(() => {
    delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  });

  it("can fetch provider /version", async () => {
    const [provider] = providers;
    const [proxyResponse, providerResponse] = await Promise.all([fetchProvider(provider, "/version"), fetch(`${provider.hostUri}/version`)]);
    expect(proxyResponse.ok).toBe(true);

    const [proxyData, providerData] = await Promise.all([proxyResponse.json(), providerResponse.json()]);
    expect(proxyData).toBeTruthy();
    expect(proxyData).toEqual(providerData);
  });

  it("can fetch provider /status", async () => {
    const [provider] = providers;
    const [proxyResponse, providerResponse] = await Promise.all([fetchProvider(provider, "/status"), fetch(`${provider.hostUri}/status`)]);
    expect(proxyResponse.ok).toBe(true);
    expect(providerResponse.ok).toBe(true);

    const [proxyData, providerData] = await Promise.all([proxyResponse.json(), providerResponse.json()]);
    expect(proxyData).toMatchObject({
      address: provider.owner,
      cluster_public_hostname: new URL(provider.hostUri).hostname
    });
    const [proxyShape, providerShape] = describeComparableShapes(proxyData, providerData);
    expect(proxyShape).toEqual(providerShape);
  });
});
