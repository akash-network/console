import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { fetchAvailableProviders, fetchProvider, type Provider } from "./setup/fetchProvider";

describe("Provider Proxy API", () => {
  beforeAll(() => {
    // ensure that tests can run against providers with self-signed certificates
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  });

  afterAll(() => {
    delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  });

  it("can fetch provider /version", async () => {
    const [provider] = await getProviders();
    const [proxyResponse, providerResponse] = await Promise.all([fetchProvider(provider, "/version"), fetch(`${provider.hostUri}/version`)]);
    expect(proxyResponse.ok).toBe(true);

    const [proxyData, providerData] = await Promise.all([proxyResponse.json(), providerResponse.json()]);
    expect(proxyData).toBeTruthy();
    expect(proxyData).toEqual(providerData);
  });

  it("can fetch provider /status", async () => {
    const [provider] = await getProviders();
    const [proxyResponse, providerResponse] = await Promise.all([fetchProvider(provider, "/status"), fetch(`${provider.hostUri}/status`)]);
    expect(proxyResponse.ok).toBe(true);
    expect(providerResponse.ok).toBe(true);

    const [proxyData, providerData] = await Promise.all([proxyResponse.json(), providerResponse.json()]);
    expect(proxyData).toBeTruthy();
    expect(proxyData).toEqual(providerData);
  });

  let providersPromise: Promise<Provider[]> | undefined;
  async function getProviders() {
    providersPromise ??= fetchAvailableProviders();
    return providersPromise;
  }
});
