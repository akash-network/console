import type { LoggerService } from "@akashnetwork/logging";
import { setTimeout } from "timers/promises";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ProviderInventoryService } from "../ProviderInventoryService/ProviderInventoryService";
import type { ProviderService } from "../ProviderService/ProviderService";
import type { ProviderHostVerifierInstrumentation } from "./ProviderHostVerifier";
import { createProviderHostVerifierInstrumentation, ProviderHostVerifier } from "./ProviderHostVerifier";

describe(ProviderHostVerifier.name, () => {
  const ONE_MINUTE = 60 * 1000;
  const THIRTY_MINUTES = 30 * ONE_MINUTE;
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

    it("asks chain again once the clock moved back past the time it last checked", async () => {
      const clock = { now: Date.now() };
      const { verifier, providerService } = setup({ now: () => clock.now });
      providerService.getHostUri.mockResolvedValue(REGISTERED_HOST);

      await verifier.canProxyTo(`${REGISTERED_HOST}/status`, PROVIDER_ADDRESS);
      await verifier.canProxyTo(`${REGISTERED_HOST}/status`, PROVIDER_ADDRESS);
      expect(providerService.getHostUri).toHaveBeenCalledTimes(1);

      clock.now -= 1;
      await verifier.canProxyTo(`${REGISTERED_HOST}/status`, PROVIDER_ADDRESS);
      expect(providerService.getHostUri).toHaveBeenCalledTimes(2);
    });

    it("asks chain again before refusing a host that differs from the one on record, at most once a minute", async () => {
      const clock = { now: Date.now() };
      const { verifier, providerService } = setup({ now: () => clock.now });
      providerService.getHostUri.mockResolvedValue(REGISTERED_HOST);

      await verifier.canProxyTo(`${REGISTERED_HOST}/status`, PROVIDER_ADDRESS);
      clock.now += ONE_MINUTE - 1;
      expect(await verifier.canProxyTo(`${OTHER_HOST}/status`, PROVIDER_ADDRESS)).toBe(false);
      expect(providerService.getHostUri).toHaveBeenCalledTimes(1);

      clock.now += 1;
      expect(await verifier.canProxyTo(`${OTHER_HOST}/status`, PROVIDER_ADDRESS)).toBe(false);
      expect(providerService.getHostUri).toHaveBeenCalledTimes(2);
    });

    it("refuses repeated requests for a provider chain has no record of without asking chain each time", async () => {
      const { verifier, providerService } = setup();
      providerService.getHostUri.mockResolvedValue(null);

      await verifier.canProxyTo(`${REGISTERED_HOST}/status`, PROVIDER_ADDRESS);
      const result = await verifier.canProxyTo(`${REGISTERED_HOST}/status`, PROVIDER_ADDRESS);

      expect(result).toBe(false);
      expect(providerService.getHostUri).toHaveBeenCalledTimes(1);
    });

    it("allows a host the provider changed to on chain once a minute has passed since the last check", async () => {
      const clock = { now: Date.now() };
      const { verifier, providerService } = setup({ now: () => clock.now });
      providerService.getHostUri.mockResolvedValueOnce(REGISTERED_HOST).mockResolvedValueOnce(OTHER_HOST);

      await verifier.canProxyTo(`${REGISTERED_HOST}/status`, PROVIDER_ADDRESS);
      clock.now += ONE_MINUTE;
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
      const clock = { now: Date.now() };
      const { verifier, providerService } = setup({ now: () => clock.now });
      providerService.getHostUri.mockResolvedValueOnce(REGISTERED_HOST).mockRejectedValue(new Error("chain is halted"));

      await verifier.canProxyTo(`${REGISTERED_HOST}/status`, PROVIDER_ADDRESS);
      clock.now += ONE_MINUTE;
      const result = await verifier.canProxyTo(`${OTHER_HOST}/status`, PROVIDER_ADDRESS);

      expect(result).toBe(false);
      expect(providerService.getHostUri).toHaveBeenCalledTimes(2);
    });

    it("keeps refusing a provider chain had no record of while chain cannot be queried", async () => {
      const clock = { now: Date.now() };
      const { verifier, providerService } = setup({ now: () => clock.now });
      providerService.getHostUri.mockResolvedValueOnce(null).mockRejectedValue(new Error("chain is halted"));

      await verifier.canProxyTo(`${REGISTERED_HOST}/status`, PROVIDER_ADDRESS);
      clock.now += ONE_MINUTE;
      const result = await verifier.canProxyTo(`${REGISTERED_HOST}/status`, PROVIDER_ADDRESS);

      expect(result).toBe(false);
      expect(providerService.getHostUri).toHaveBeenCalledTimes(2);
    });

    it("allows a provider it has not looked up yet while chain cannot be queried and no provider inventory is configured", async () => {
      const { verifier, providerService } = setup();
      providerService.getHostUri.mockRejectedValue(new Error("chain is halted"));

      expect(await verifier.canProxyTo(`${REGISTERED_HOST}/status`, PROVIDER_ADDRESS)).toBe(true);
    });

    it("waits a minute before asking chain again about a provider it could not look up", async () => {
      const clock = { now: Date.now() };
      const { verifier, providerService } = setup({ now: () => clock.now });
      providerService.getHostUri.mockRejectedValue(new Error("chain is halted"));

      await verifier.canProxyTo(`${REGISTERED_HOST}/status`, PROVIDER_ADDRESS);
      clock.now += ONE_MINUTE - 1;
      expect(await verifier.canProxyTo(`${REGISTERED_HOST}/status`, PROVIDER_ADDRESS)).toBe(true);
      expect(providerService.getHostUri).toHaveBeenCalledTimes(1);

      clock.now += 1;
      await verifier.canProxyTo(`${REGISTERED_HOST}/status`, PROVIDER_ADDRESS);
      expect(providerService.getHostUri).toHaveBeenCalledTimes(2);
    });

    it("checks a provider it could not look up once chain answers again", async () => {
      const clock = { now: Date.now() };
      const { verifier, providerService } = setup({ now: () => clock.now });
      providerService.getHostUri.mockRejectedValueOnce(new Error("chain is halted")).mockResolvedValue(REGISTERED_HOST);

      await verifier.canProxyTo(`${OTHER_HOST}/status`, PROVIDER_ADDRESS);
      clock.now += ONE_MINUTE;
      const result = await verifier.canProxyTo(`${OTHER_HOST}/status`, PROVIDER_ADDRESS);

      expect(result).toBe(false);
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

    describe("when a provider inventory is configured", () => {
      it("does not ask the provider inventory while chain answers", async () => {
        const { verifier, providerService, providerInventory } = setup({ withProviderInventory: true });
        providerService.getHostUri.mockResolvedValue(REGISTERED_HOST);

        await verifier.canProxyTo(`${REGISTERED_HOST}/status`, PROVIDER_ADDRESS);

        expect(providerInventory.getHostUri).not.toHaveBeenCalled();
      });

      it("allows a URL on the host the provider inventory has on record while chain cannot be queried", async () => {
        const { verifier, providerService, providerInventory } = setup({ withProviderInventory: true });
        providerService.getHostUri.mockRejectedValue(new Error("chain is halted"));
        providerInventory.getHostUri.mockResolvedValue(REGISTERED_HOST);

        expect(await verifier.canProxyTo(`${REGISTERED_HOST}/status`, PROVIDER_ADDRESS)).toBe(true);
        expect(providerInventory.getHostUri).toHaveBeenCalledWith(PROVIDER_ADDRESS);
      });

      it("refuses a URL on another host than the provider inventory has on record while chain cannot be queried", async () => {
        const { verifier, providerService, providerInventory, instrumentation } = setup({ withProviderInventory: true, withInstrumentation: true });
        providerService.getHostUri.mockRejectedValue(new Error("chain is halted"));
        providerInventory.getHostUri.mockResolvedValue(REGISTERED_HOST);

        expect(await verifier.canProxyTo(`${OTHER_HOST}/status`, PROVIDER_ADDRESS)).toBe(false);
        expect(instrumentation.onUnregisteredHost).toHaveBeenCalledWith(`${OTHER_HOST}/status`, PROVIDER_ADDRESS, REGISTERED_HOST);
      });

      it("refuses a provider the provider inventory has no record of while chain cannot be queried", async () => {
        const { verifier, providerService, providerInventory } = setup({ withProviderInventory: true });
        providerService.getHostUri.mockRejectedValue(new Error("chain is halted"));
        providerInventory.getHostUri.mockResolvedValue(null);

        expect(await verifier.canProxyTo(`${REGISTERED_HOST}/status`, PROVIDER_ADDRESS)).toBe(false);
      });

      it("allows a provider it has not looked up yet when neither chain nor the provider inventory can be queried", async () => {
        const { verifier, providerService, providerInventory, instrumentation } = setup({ withProviderInventory: true, withInstrumentation: true });
        providerService.getHostUri.mockRejectedValue(new Error("chain is halted"));
        providerInventory.getHostUri.mockRejectedValue(new Error("inventory is down"));

        expect(await verifier.canProxyTo(`${REGISTERED_HOST}/status`, PROVIDER_ADDRESS)).toBe(true);
        expect(instrumentation.onUnverifiedHost).toHaveBeenCalledWith(`${REGISTERED_HOST}/status`, PROVIDER_ADDRESS);
      });

      it("asks the provider inventory again a minute after neither chain nor the provider inventory could be queried", async () => {
        const clock = { now: Date.now() };
        const { verifier, providerService, providerInventory } = setup({ now: () => clock.now, withProviderInventory: true });
        providerService.getHostUri.mockRejectedValue(new Error("chain is halted"));
        providerInventory.getHostUri.mockRejectedValueOnce(new Error("inventory is down")).mockResolvedValue(REGISTERED_HOST);

        await verifier.canProxyTo(`${OTHER_HOST}/status`, PROVIDER_ADDRESS);
        clock.now += ONE_MINUTE - 1;
        expect(await verifier.canProxyTo(`${OTHER_HOST}/status`, PROVIDER_ADDRESS)).toBe(true);
        expect(providerInventory.getHostUri).toHaveBeenCalledTimes(1);

        clock.now += 1;
        expect(await verifier.canProxyTo(`${OTHER_HOST}/status`, PROVIDER_ADDRESS)).toBe(false);
        expect(providerInventory.getHostUri).toHaveBeenCalledTimes(2);
      });

      it("keeps the host chain last reported without asking the provider inventory while chain cannot be queried", async () => {
        const clock = { now: Date.now() };
        const { verifier, providerService, providerInventory } = setup({ now: () => clock.now, withProviderInventory: true });
        providerService.getHostUri.mockResolvedValueOnce(REGISTERED_HOST).mockRejectedValue(new Error("chain is halted"));
        providerInventory.getHostUri.mockResolvedValue(OTHER_HOST);

        await verifier.canProxyTo(`${REGISTERED_HOST}/status`, PROVIDER_ADDRESS);
        clock.now += THIRTY_MINUTES;
        const result = await verifier.canProxyTo(`${REGISTERED_HOST}/status`, PROVIDER_ADDRESS);

        expect(result).toBe(true);
        expect(providerInventory.getHostUri).not.toHaveBeenCalled();
      });

      it("keeps the host the provider inventory reported without asking it again while chain cannot be queried", async () => {
        const clock = { now: Date.now() };
        const { verifier, providerService, providerInventory } = setup({ now: () => clock.now, withProviderInventory: true });
        providerService.getHostUri.mockRejectedValue(new Error("chain is halted"));
        providerInventory.getHostUri.mockResolvedValue(REGISTERED_HOST);

        await verifier.canProxyTo(`${REGISTERED_HOST}/status`, PROVIDER_ADDRESS);
        clock.now += THIRTY_MINUTES;
        const result = await verifier.canProxyTo(`${OTHER_HOST}/status`, PROVIDER_ADDRESS);

        expect(result).toBe(false);
        expect(providerService.getHostUri).toHaveBeenCalledTimes(2);
        expect(providerInventory.getHostUri).toHaveBeenCalledTimes(1);
      });

      it("follows chain over the provider inventory once chain answers again", async () => {
        const clock = { now: Date.now() };
        const { verifier, providerService, providerInventory } = setup({ now: () => clock.now, withProviderInventory: true });
        providerService.getHostUri.mockRejectedValueOnce(new Error("chain is halted")).mockResolvedValue(OTHER_HOST);
        providerInventory.getHostUri.mockResolvedValue(REGISTERED_HOST);

        await verifier.canProxyTo(`${REGISTERED_HOST}/status`, PROVIDER_ADDRESS);
        clock.now += ONE_MINUTE;
        const result = await verifier.canProxyTo(`${OTHER_HOST}/status`, PROVIDER_ADDRESS);

        expect(result).toBe(true);
      });

      it("asks the provider inventory once for concurrent requests while chain cannot be queried", async () => {
        const { verifier, providerService, providerInventory } = setup({ withProviderInventory: true });
        providerService.getHostUri.mockRejectedValue(new Error("chain is halted"));
        providerInventory.getHostUri.mockImplementation(() => setTimeout(20, REGISTERED_HOST));

        const results = await Promise.all([
          verifier.canProxyTo(`${REGISTERED_HOST}/status`, PROVIDER_ADDRESS),
          verifier.canProxyTo(`${REGISTERED_HOST}/logs`, PROVIDER_ADDRESS),
          verifier.canProxyTo(`${OTHER_HOST}/events`, PROVIDER_ADDRESS)
        ]);

        expect(results).toEqual([true, true, false]);
        expect(providerInventory.getHostUri).toHaveBeenCalledTimes(1);
      });
    });
  });

  function setup(input?: { now?: () => number; withInstrumentation?: boolean; withProviderInventory?: boolean }) {
    const providerService = mock<ProviderService>();
    const providerInventory = mock<ProviderInventoryService>();
    const instrumentation = mock<ProviderHostVerifierInstrumentation>();
    const verifier = new ProviderHostVerifier(
      input?.now ?? Date.now,
      providerService,
      input?.withProviderInventory ? providerInventory : undefined,
      input?.withInstrumentation ? instrumentation : undefined
    );

    return { verifier, providerService, providerInventory, instrumentation };
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
