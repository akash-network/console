import type { LoggerService } from "@akashnetwork/logging";
import { setTimeout } from "timers/promises";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ProviderService } from "../ProviderService/ProviderService";
import type { ProviderHostVerifierInstrumentation } from "./ProviderHostVerifier";
import { createProviderHostVerifierInstrumentation, ProviderHostVerifier } from "./ProviderHostVerifier";

describe(ProviderHostVerifier.name, () => {
  const THIRTY_MINUTES = 30 * 60 * 1000;
  const PROVIDER_ADDRESS = "akash18ga02jzaq8cw52anyhzkwta5wygufgu6zsz6xc";
  const REGISTERED_HOST = "https://provider.example.com:8443";
  const OTHER_HOST = "https://other.example.com:8443";

  describe("canProxyTo", () => {
    it("allows a URL on the host the provider registered on chain", async () => {
      const { verifier, providerService } = setup();
      providerService.getHostUri.mockResolvedValue(REGISTERED_HOST);

      expect(await verifier.canProxyTo(`${REGISTERED_HOST}/lease/1/1/1/status`, PROVIDER_ADDRESS)).toBe(true);
      expect(providerService.getHostUri).toHaveBeenCalledWith(PROVIDER_ADDRESS);
    });

    it("matches the registered host regardless of hostname case, default port and path", async () => {
      const { verifier, providerService } = setup();
      providerService.getHostUri.mockResolvedValue("https://Provider.Example.com:443/");

      expect(await verifier.canProxyTo("https://provider.example.com/status", PROVIDER_ADDRESS)).toBe(true);
    });

    it("refuses a URL on another host and reports the host chain has on record", async () => {
      const { verifier, providerService, instrumentation } = setup({ withInstrumentation: true });
      providerService.getHostUri.mockResolvedValue(REGISTERED_HOST);

      expect(await verifier.canProxyTo(`${OTHER_HOST}/status`, PROVIDER_ADDRESS)).toBe(false);
      expect(instrumentation.onUnregisteredHost).toHaveBeenCalledWith(`${OTHER_HOST}/status`, PROVIDER_ADDRESS, REGISTERED_HOST);
    });

    it("refuses a URL on the same hostname but another port", async () => {
      const { verifier, providerService } = setup();
      providerService.getHostUri.mockResolvedValue(REGISTERED_HOST);

      expect(await verifier.canProxyTo("https://provider.example.com:9443/status", PROVIDER_ADDRESS)).toBe(false);
    });

    it("refuses a provider chain has no record of", async () => {
      const { verifier, providerService } = setup();
      providerService.getHostUri.mockResolvedValue(null);

      expect(await verifier.canProxyTo(`${REGISTERED_HOST}/status`, PROVIDER_ADDRESS)).toBe(false);
    });

    it("refuses every URL when the registered host URI cannot be parsed", async () => {
      const { verifier, providerService } = setup();
      providerService.getHostUri.mockResolvedValue("https://provider.example.com:8008:8443");

      expect(await verifier.canProxyTo("https://provider.example.com:8008/status", PROVIDER_ADDRESS)).toBe(false);
    });

    it("reuses the host chain reported until 30 minutes have passed", async () => {
      const clock = { now: Date.now() };
      const { verifier, providerService } = setup({ now: () => clock.now });
      providerService.getHostUri.mockResolvedValue(REGISTERED_HOST);

      await verifier.canProxyTo(`${REGISTERED_HOST}/status`, PROVIDER_ADDRESS);
      clock.now += THIRTY_MINUTES - 1;
      await verifier.canProxyTo(`${REGISTERED_HOST}/status`, PROVIDER_ADDRESS);
      expect(providerService.getHostUri).toHaveBeenCalledTimes(1);

      clock.now += 1;
      expect(await verifier.canProxyTo(`${REGISTERED_HOST}/status`, PROVIDER_ADDRESS)).toBe(true);
      expect(providerService.getHostUri).toHaveBeenCalledTimes(2);
    });

    it("asks chain again before refusing a host that differs from the one it has on record", async () => {
      const { verifier, providerService } = setup();
      providerService.getHostUri.mockResolvedValue(REGISTERED_HOST);

      await verifier.canProxyTo(`${REGISTERED_HOST}/status`, PROVIDER_ADDRESS);
      const result = await verifier.canProxyTo(`${OTHER_HOST}/status`, PROVIDER_ADDRESS);

      expect(result).toBe(false);
      expect(providerService.getHostUri).toHaveBeenCalledTimes(2);
    });

    it("allows a host the provider just changed to on chain", async () => {
      const { verifier, providerService } = setup();
      providerService.getHostUri.mockResolvedValueOnce(REGISTERED_HOST).mockResolvedValueOnce(OTHER_HOST);

      await verifier.canProxyTo(`${REGISTERED_HOST}/status`, PROVIDER_ADDRESS);
      const result = await verifier.canProxyTo(`${OTHER_HOST}/status`, PROVIDER_ADDRESS);

      expect(result).toBe(true);
    });

    it("keeps allowing the host chain last reported while chain cannot be queried", async () => {
      const clock = { now: Date.now() };
      const { verifier, providerService } = setup({ now: () => clock.now });
      providerService.getHostUri.mockResolvedValueOnce(REGISTERED_HOST).mockRejectedValue(new Error("chain is halted"));

      await verifier.canProxyTo(`${REGISTERED_HOST}/status`, PROVIDER_ADDRESS);
      clock.now += 2 * THIRTY_MINUTES;
      const result = await verifier.canProxyTo(`${REGISTERED_HOST}/status`, PROVIDER_ADDRESS);

      expect(result).toBe(true);
      expect(providerService.getHostUri).toHaveBeenCalledTimes(2);
    });

    it("waits another 30 minutes before asking chain again after chain could not be queried", async () => {
      const clock = { now: Date.now() };
      const { verifier, providerService } = setup({ now: () => clock.now });
      providerService.getHostUri.mockResolvedValueOnce(REGISTERED_HOST).mockRejectedValue(new Error("chain is halted"));

      await verifier.canProxyTo(`${REGISTERED_HOST}/status`, PROVIDER_ADDRESS);
      clock.now += THIRTY_MINUTES;
      await verifier.canProxyTo(`${REGISTERED_HOST}/status`, PROVIDER_ADDRESS);
      clock.now += THIRTY_MINUTES - 1;
      const result = await verifier.canProxyTo(`${REGISTERED_HOST}/status`, PROVIDER_ADDRESS);

      expect(result).toBe(true);
      expect(providerService.getHostUri).toHaveBeenCalledTimes(2);
    });

    it("keeps refusing a host chain did not report while chain cannot be queried", async () => {
      const { verifier, providerService } = setup();
      providerService.getHostUri.mockResolvedValueOnce(REGISTERED_HOST).mockRejectedValue(new Error("chain is halted"));

      await verifier.canProxyTo(`${REGISTERED_HOST}/status`, PROVIDER_ADDRESS);
      const result = await verifier.canProxyTo(`${OTHER_HOST}/status`, PROVIDER_ADDRESS);

      expect(result).toBe(false);
    });

    it("keeps refusing a provider chain had no record of while chain cannot be queried", async () => {
      const { verifier, providerService } = setup();
      providerService.getHostUri.mockResolvedValueOnce(null).mockRejectedValue(new Error("chain is halted"));

      await verifier.canProxyTo(`${REGISTERED_HOST}/status`, PROVIDER_ADDRESS);
      const result = await verifier.canProxyTo(`${REGISTERED_HOST}/status`, PROVIDER_ADDRESS);

      expect(result).toBe(false);
    });

    it("allows a provider it has not looked up yet while chain cannot be queried", async () => {
      const { verifier, providerService } = setup();
      providerService.getHostUri.mockRejectedValue(new Error("chain is halted"));

      expect(await verifier.canProxyTo(`${REGISTERED_HOST}/status`, PROVIDER_ADDRESS)).toBe(true);
    });

    it("reports a host it lets through without being able to check it", async () => {
      const { verifier, providerService, instrumentation } = setup({ withInstrumentation: true });
      providerService.getHostUri.mockRejectedValue(new Error("chain is halted"));

      await verifier.canProxyTo(`${REGISTERED_HOST}/status`, PROVIDER_ADDRESS);

      expect(instrumentation.onUnverifiedHost).toHaveBeenCalledWith(`${REGISTERED_HOST}/status`, PROVIDER_ADDRESS);
      expect(instrumentation.onUnregisteredHost).not.toHaveBeenCalled();
    });

    it("looks up a provider once for concurrent requests", async () => {
      const { verifier, providerService } = setup();
      providerService.getHostUri.mockImplementation(() => setTimeout(20, REGISTERED_HOST));

      const results = await Promise.all([
        verifier.canProxyTo(`${REGISTERED_HOST}/status`, PROVIDER_ADDRESS),
        verifier.canProxyTo(`${REGISTERED_HOST}/logs`, PROVIDER_ADDRESS),
        verifier.canProxyTo(`${REGISTERED_HOST}/events`, PROVIDER_ADDRESS)
      ]);

      expect(results).toEqual([true, true, true]);
      expect(providerService.getHostUri).toHaveBeenCalledTimes(1);
    });
  });

  function setup(input?: { now?: () => number; withInstrumentation?: boolean }) {
    const providerService = mock<ProviderService>();
    const instrumentation = mock<ProviderHostVerifierInstrumentation>();
    const verifier = new ProviderHostVerifier(input?.now ?? Date.now, providerService, input?.withInstrumentation ? instrumentation : undefined);

    return { verifier, providerService, instrumentation };
  }
});

describe(createProviderHostVerifierInstrumentation.name, () => {
  it("logs a host let through without a check", () => {
    const logger = mock<LoggerService>();

    createProviderHostVerifierInstrumentation(logger).onUnverifiedHost?.("https://provider.example.com/status", "provider");

    expect(logger.warn).toHaveBeenCalledWith({ event: "PROVIDER_HOST_UNVERIFIED", url: "https://provider.example.com/status", providerAddress: "provider" });
  });

  it("logs a refused host with the host chain has on record", () => {
    const logger = mock<LoggerService>();

    createProviderHostVerifierInstrumentation(logger).onUnregisteredHost?.("https://other.example.com/status", "provider", "https://provider.example.com");

    expect(logger.warn).toHaveBeenCalledWith({
      event: "PROVIDER_HOST_NOT_REGISTERED",
      url: "https://other.example.com/status",
      providerAddress: "provider",
      registeredOrigin: "https://provider.example.com"
    });
  });
});
