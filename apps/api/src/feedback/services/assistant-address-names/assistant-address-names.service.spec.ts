import type { Provider } from "@akashnetwork/database/dbSchemas/akash";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";
import type { CreateLogger } from "@src/core";
import type { ProviderRepository } from "@src/provider/repositories/provider/provider.repository";
import type { UserOutput } from "@src/user/repositories";
import { akashAddressesIn, AssistantAddressNamesService, providerNameOf } from "./assistant-address-names.service";

const PROVIDER = "akash1rk090a6mq9gvm0h6ljf8kz8mrxglwwxsk4srxh";
const OWN_WALLET = "akash13265twfqejnma6cc93rw5dxk4cldyz2zyy8cdm";
const GRANTER = "akash18ga02jzaq8cw52anyhzkwta5wygufgu6zsz6xc";

describe(AssistantAddressNamesService.name, () => {
  describe(providerNameOf.name, () => {
    it("names a provider by the host of its URI", () => {
      expect(providerNameOf("https://provider.europlots.com:8443")).toBe("provider.europlots.com");
    });

    it("keeps a URI it cannot parse as it is", () => {
      expect(providerNameOf("provider.europlots.com")).toBe("provider.europlots.com");
    });
  });

  describe(akashAddressesIn.name, () => {
    it("finds each account address once and skips validator addresses", () => {
      expect(akashAddressesIn(`${PROVIDER} paid ${PROVIDER} via akashvaloper1rk090a6mq9gvm0h6ljf8kz8mrxglwwxsk4srxh and ${GRANTER}`)).toEqual([
        PROVIDER,
        GRANTER
      ]);
    });
  });

  describe("providerNamesOf", () => {
    it("looks every provider up once and names it by its host", async () => {
      const { service, providerRepository } = setup({ providers: { [PROVIDER]: "https://provider.europlots.com:8443" } });

      const names = await service.providerNamesOf([PROVIDER, PROVIDER, GRANTER]);

      expect(providerRepository.getProvidersByAddressesWithAttributes).toHaveBeenCalledWith([PROVIDER, GRANTER]);
      expect(names).toEqual(new Map([[PROVIDER, "provider.europlots.com"]]));
    });

    it("looks nothing up without addresses", async () => {
      const { service, providerRepository } = setup();

      expect(await service.providerNamesOf([])).toEqual(new Map());
      expect(providerRepository.getProvidersByAddressesWithAttributes).not.toHaveBeenCalled();
    });

    it("names no provider and logs the failure when the lookup fails", async () => {
      const error = new Error("connection refused");
      const { service, providerRepository, logger } = setup();
      providerRepository.getProvidersByAddressesWithAttributes.mockRejectedValue(error);

      expect(await service.providerNamesOf([PROVIDER])).toEqual(new Map());
      expect(logger.warn).toHaveBeenCalledWith({ event: "ASSISTANT_PROVIDER_NAMES_FAILED", error });
    });
  });

  describe("withAddressesNamed", () => {
    it("names providers, the user's own wallet and every other account without their addresses", async () => {
      const { service, userWalletRepository } = setup({ providers: { [PROVIDER]: "https://provider.europlots.com:8443" }, ownWallet: OWN_WALLET });

      const named = await service.withAddressesNamed(JSON.stringify({ provider: PROVIDER, owner: OWN_WALLET, granter: GRANTER, note: `Lease on ${PROVIDER}` }));

      expect(JSON.parse(named)).toEqual({
        provider: "provider provider.europlots.com",
        owner: "your Console wallet",
        granter: "another Akash account",
        note: "Lease on provider provider.europlots.com"
      });
      expect(userWalletRepository.findOneUsedBy).toHaveBeenCalledWith("user-1");
    });

    it("names the user's address as another account when they have no wallet", async () => {
      const { service } = setup();

      expect(await service.withAddressesNamed(OWN_WALLET)).toBe("another Akash account");
    });

    it("leaves a text without addresses untouched and looks nothing up", async () => {
      const { service, providerRepository, userWalletRepository } = setup();

      expect(await service.withAddressesNamed('{"name":"web"}')).toBe('{"name":"web"}');
      expect(providerRepository.getProvidersByAddressesWithAttributes).not.toHaveBeenCalled();
      expect(userWalletRepository.findOneUsedBy).not.toHaveBeenCalled();
    });

    it("fails rather than label a provider as another account when the lookup fails", async () => {
      const { service, providerRepository } = setup();
      providerRepository.getProvidersByAddressesWithAttributes.mockRejectedValue(new Error("connection refused"));

      await expect(service.withAddressesNamed(PROVIDER)).rejects.toThrow("connection refused");
    });
  });

  function setup(input: { providers?: Record<string, string>; ownWallet?: string } = {}) {
    const providerRepository = mock<ProviderRepository>();
    providerRepository.getProvidersByAddressesWithAttributes.mockResolvedValue(
      Object.entries(input.providers ?? {}).map(([owner, hostUri]) => mock<Provider>({ owner, hostUri }))
    );
    const userWalletRepository = mock<UserWalletRepository>();
    userWalletRepository.findOneUsedBy.mockResolvedValue(input.ownWallet ? mock<UserWalletOutput>({ address: input.ownWallet }) : undefined);
    const authService = mock<AuthService>({ currentUser: mock<UserOutput>({ id: "user-1" }) });
    const logger = mock<ReturnType<CreateLogger>>();
    const service = new AssistantAddressNamesService(
      providerRepository,
      userWalletRepository,
      authService,
      vi.fn<CreateLogger>(() => logger)
    );

    return { service, providerRepository, userWalletRepository, logger };
  }
});
