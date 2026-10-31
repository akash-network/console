import { createHttpClient, type HttpClient } from "@akashnetwork/http-sdk";
import { faker } from "@faker-js/faker";
import nock from "nock";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ProviderProxyPayload } from "./provider-proxy.service";
import { MAX_PROVIDER_RESPONSE_BYTES, ProviderProxyService } from "./provider-proxy.service";

describe(ProviderProxyService.name, () => {
  describe("request", () => {
    it("sends POST request to / with mapped payload and returns response data", async () => {
      const { httpClient, service, url, options } = setup();
      const data = { result: faker.string.uuid() };
      httpClient.post.mockResolvedValue({ data });

      const result = await service.request(url, options);

      expect(result).toBe(data);
      expect(httpClient.post).toHaveBeenCalledWith(
        "/",
        {
          auth: options.auth,
          method: "GET",
          url: options.providerIdentity.hostUri + url,
          providerAddress: options.providerIdentity.owner
        },
        { maxRedirects: 0, maxContentLength: MAX_PROVIDER_RESPONSE_BYTES }
      );
    });

    it("uses the provided method instead of default GET", async () => {
      const { httpClient, service, url, options } = setup({ method: "POST" });
      httpClient.post.mockResolvedValue({ data: {} });

      await service.request(url, options);

      expect(httpClient.post).toHaveBeenCalledWith("/", expect.objectContaining({ method: "POST" }), expect.any(Object));
    });

    it("forwards body and headers in the payload", async () => {
      const body = faker.string.sample();
      const headers = { "x-custom": faker.string.uuid() };
      const { httpClient, service, url, options } = setup({ body, headers });
      httpClient.post.mockResolvedValue({ data: {} });

      await service.request(url, options);

      expect(httpClient.post).toHaveBeenCalledWith("/", expect.objectContaining({ body, headers }), expect.any(Object));
    });

    it("passes timeout in both payload and config when within max", async () => {
      const timeout = 5_000;
      const { httpClient, service, url, options } = setup({ timeout });
      httpClient.post.mockResolvedValue({ data: {} });

      await service.request(url, options);

      expect(httpClient.post).toHaveBeenCalledWith("/", expect.objectContaining({ timeout }), {
        maxRedirects: 0,
        maxContentLength: MAX_PROVIDER_RESPONSE_BYTES,
        timeout: 5 * timeout
      });
    });

    it("does not include timeout when not provided", async () => {
      const { httpClient, service, url, options } = setup({ timeout: undefined });
      httpClient.post.mockResolvedValue({ data: {} });

      await service.request(url, options);

      const [, payload, config] = httpClient.post.mock.calls[0];
      expect(payload).toHaveProperty("timeout", undefined);
      expect(config).toEqual({ maxRedirects: 0, maxContentLength: MAX_PROVIDER_RESPONSE_BYTES });
    });

    it("refuses a redirect the provider answered with instead of following it", async () => {
      const proxyUrl = "http://provider-proxy.test";
      const internalUrl = "http://internal.test";
      const service = new ProviderProxyService(createHttpClient({ baseURL: proxyUrl }));
      nock(proxyUrl)
        .post("/")
        .reply(302, "", { Location: `${internalUrl}/secret` });
      const internal = nock(internalUrl).get("/secret").reply(200, { leaked: true });

      await expect(service.request("/status", { providerIdentity: { owner: "akash1provider", hostUri: "https://provider.test:8443" } })).rejects.toMatchObject({
        response: { status: 302 }
      });
      expect(internal.isDone()).toBe(false);
      nock.cleanAll();
    });

    it("rejects a provider response larger than the size limit", async () => {
      const { service, proxyUrl } = setupWithProxy();
      nock(proxyUrl)
        .post("/")
        .reply(200, Buffer.alloc(MAX_PROVIDER_RESPONSE_BYTES + 1, "a"));

      await expect(service.request("/status", { providerIdentity: { owner: "akash1provider", hostUri: "https://provider.test:8443" } })).rejects.toMatchObject({
        code: "ERR_BAD_RESPONSE",
        message: `maxContentLength size of ${MAX_PROVIDER_RESPONSE_BYTES} exceeded`
      });
      nock.cleanAll();
    });

    it("returns a provider response at the size limit", async () => {
      const { service, proxyUrl } = setupWithProxy();
      const body = "a".repeat(MAX_PROVIDER_RESPONSE_BYTES);
      nock(proxyUrl).post("/").reply(200, body);

      const result = await service.request("/status", { providerIdentity: { owner: "akash1provider", hostUri: "https://provider.test:8443" } });

      expect(result).toBe(body);
      nock.cleanAll();
    });
  });

  function setupWithProxy() {
    const proxyUrl = "http://provider-proxy.test";
    const service = new ProviderProxyService(createHttpClient({ baseURL: proxyUrl }));
    return { service, proxyUrl };
  }

  function setup(overrides?: Partial<ProviderProxyPayload>) {
    const httpClient = mock<HttpClient>();
    const service = new ProviderProxyService(httpClient);
    const url = `/${faker.word.noun()}`;
    const options: ProviderProxyPayload = {
      providerIdentity: {
        owner: faker.string.alphanumeric(44),
        hostUri: faker.internet.url({ appendSlash: false })
      },
      auth: {
        type: "jwt",
        token: faker.string.sample()
      },
      ...overrides
    };

    return { httpClient, service, url, options };
  }
});
