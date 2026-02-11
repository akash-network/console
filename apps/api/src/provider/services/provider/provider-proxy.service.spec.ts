import type { HttpClient } from "@akashnetwork/http-sdk";
import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ProviderProxyPayload } from "./provider-proxy.service";
import { ProviderProxyService } from "./provider-proxy.service";

describe(ProviderProxyService.name, () => {
  const MAX_TIMEOUT = 30_000;

  describe("request", () => {
    it("should POST to / with mapped payload and return response data", async () => {
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
          providerAddress: options.providerIdentity.owner,
          network: options.chainNetwork
        },
        {}
      );
    });

    it("should use the provided method instead of default GET", async () => {
      const { httpClient, service, url, options } = setup({ method: "POST" });
      httpClient.post.mockResolvedValue({ data: {} });

      await service.request(url, options);

      expect(httpClient.post).toHaveBeenCalledWith("/", expect.objectContaining({ method: "POST" }), expect.any(Object));
    });

    it("should forward body and headers in the payload", async () => {
      const body = faker.string.sample();
      const headers = { "x-custom": faker.string.uuid() };
      const { httpClient, service, url, options } = setup({ body, headers });
      httpClient.post.mockResolvedValue({ data: {} });

      await service.request(url, options);

      expect(httpClient.post).toHaveBeenCalledWith("/", expect.objectContaining({ body, headers }), expect.any(Object));
    });

    it("should pass timeout in both payload and config when within max", async () => {
      const timeout = 5_000;
      const { httpClient, service, url, options } = setup({ timeout });
      httpClient.post.mockResolvedValue({ data: {} });

      await service.request(url, options);

      expect(httpClient.post).toHaveBeenCalledWith("/", expect.objectContaining({ timeout }), { timeout });
    });

    it("should cap timeout to max when it exceeds the limit", async () => {
      const timeout = MAX_TIMEOUT + 10_000;
      const { httpClient, service, url, options } = setup({ timeout });
      httpClient.post.mockResolvedValue({ data: {} });

      await service.request(url, options);

      expect(httpClient.post).toHaveBeenCalledWith("/", expect.objectContaining({ timeout: MAX_TIMEOUT }), { timeout: MAX_TIMEOUT });
    });

    it("should not include timeout when not provided", async () => {
      const { httpClient, service, url, options } = setup({ timeout: undefined });
      httpClient.post.mockResolvedValue({ data: {} });

      await service.request(url, options);

      const [, payload, config] = httpClient.post.mock.calls[0];
      expect(payload).not.toHaveProperty("timeout");
      expect(config).toEqual({});
    });
  });

  function setup(overrides?: Partial<ProviderProxyPayload>) {
    const httpClient = mock<HttpClient>();
    const service = new ProviderProxyService(httpClient);
    const url = `/${faker.word.noun()}`;
    const options: ProviderProxyPayload = {
      chainNetwork: faker.word.noun(),
      providerIdentity: {
        owner: faker.string.alphanumeric(44),
        hostUri: faker.internet.url({ appendSlash: false })
      },
      auth: {
        type: "mtls",
        certPem: faker.string.sample(),
        keyPem: faker.string.sample()
      },
      ...overrides
    };

    return { httpClient, service, url, options };
  }
});
