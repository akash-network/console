import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it, onTestFinished } from "vitest";
import { mock, type MockProxy } from "vitest-mock-extended";

import { LoggerService } from "@src/common/services/logger/logger.service";
import { HTTP_SDK_PROVIDERS } from "@src/modules/alert/providers/http-sdk.provider";
import { ProviderHostService } from "./provider-host.service";

import { MockProvider } from "@test/mocks/provider.mock";
import { mockAkashAddress } from "@test/seeders/akash-address.seeder";

describe(ProviderHostService.name, () => {
  describe("labelFor", () => {
    it("labels the provider by the host of its on-chain host uri, without scheme or port", async () => {
      const { service, received, loggerService } = await setup({
        respond: answerWith({ provider: { host_uri: "https://provider.hurricane.akash.pub:8443" } })
      });
      const provider = mockAkashAddress();

      const label = await service.labelFor(provider);

      expect(label).toBe("provider.hurricane.akash.pub");
      expect(received).toEqual([{ method: "GET", url: `/akash/provider/v1beta4/providers/${provider}` }]);
      expect(loggerService.warn).not.toHaveBeenCalled();
    });

    it("keeps the provider address inside its own path segment", async () => {
      const { service, received } = await setup({ respond: answerWith({ provider: { host_uri: "https://provider.example.com" } }) });

      await service.labelFor("akash1provider/../x?y");

      expect(received.map(request => request.url)).toEqual(["/akash/provider/v1beta4/providers/akash1provider%2F..%2Fx%3Fy"]);
    });

    it("labels the provider by its address and warns when the chain does not know it", async () => {
      const { service, loggerService } = await setup({
        respond: response => {
          response.writeHead(404, { "content-type": "application/json" });
          response.end(JSON.stringify({ code: 5, message: "provider not found" }));
        }
      });
      const provider = mockAkashAddress();

      const label = await service.labelFor(provider);

      expect(label).toBe(provider);
      expect(loggerService.warn).toHaveBeenCalledWith({ event: "PROVIDER_HOST_LOOKUP_FAILED", provider, error: expect.any(Error) });
    });

    it.each([
      ["carries no host uri", { provider: { owner: "akash1provider" } }],
      ["carries no provider", {}],
      ["carries a host uri that is not a url", { provider: { host_uri: "provider.example.com" } }]
    ])("labels the provider by its address and warns when the chain's answer %s", async (_, body) => {
      const { service, loggerService } = await setup({ respond: answerWith(body) });
      const provider = mockAkashAddress();

      const label = await service.labelFor(provider);

      expect(label).toBe(provider);
      expect(loggerService.warn).toHaveBeenCalledWith({ event: "PROVIDER_HOST_LOOKUP_FAILED", provider, error: expect.any(Error) });
    });

    it("labels the provider by its address and warns when its host uri names no host", async () => {
      const { service, loggerService } = await setup({ respond: answerWith({ provider: { host_uri: "provider.example.com:8443" } }) });
      const provider = mockAkashAddress();

      const label = await service.labelFor(provider);

      expect(label).toBe(provider);
      expect(loggerService.warn).toHaveBeenCalledWith({
        event: "PROVIDER_HOST_LOOKUP_FAILED",
        provider,
        error: expect.objectContaining({ message: `Provider ${provider} has a host_uri without a host` })
      });
    });

    it("labels the provider by its address once the chain takes longer than the timeout to answer", async () => {
      const { service, loggerService } = await setup({ timeoutMs: 50, respond: () => {} });
      const provider = mockAkashAddress();

      const label = await service.labelFor(provider);

      expect(label).toBe(provider);
      expect(loggerService.warn).toHaveBeenCalledWith({ event: "PROVIDER_HOST_LOOKUP_FAILED", provider, error: expect.anything() });
    });
  });

  function answerWith(body: unknown) {
    return (response: ServerResponse) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(body));
    };
  }

  async function setup(input: { timeoutMs?: number; respond: (response: ServerResponse, request: IncomingMessage) => void }) {
    const received: Array<{ method?: string; url?: string }> = [];
    const server = createServer((request, response) => {
      received.push({ method: request.method, url: request.url });
      input.respond(response, request);
    });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    onTestFinished(async () => {
      server.closeAllConnections();
      if (server.listening) await new Promise<void>(resolve => server.close(() => resolve()));
    });

    const config: Record<string, unknown> = {
      "alert.API_NODE_ENDPOINT": `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
      "alert.PROVIDER_HOST_LOOKUP_TIMEOUT_MS": input.timeoutMs ?? 2000
    };
    const configService = mock<ConfigService>();
    configService.getOrThrow.mockImplementation((key: string) => config[key]);
    const module = await Test.createTestingModule({
      providers: [ProviderHostService, ...HTTP_SDK_PROVIDERS, { provide: ConfigService, useValue: configService }, MockProvider(LoggerService)]
    }).compile();

    return {
      service: module.get(ProviderHostService),
      loggerService: module.get<MockProxy<LoggerService>>(LoggerService),
      received
    };
  }
});
