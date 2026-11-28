import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ProviderTokenService } from "@src/services/provider-token/provider-token.service";
import type { TxManagerService } from "@src/services/tx-manager/tx-manager.service";
import { WalletController } from "./wallet.controller";

import { createAkashAddress } from "@test/seeders";

describe(WalletController.name, () => {
  it("lists the funding wallet addresses in the order the signer holds them", async () => {
    const { controller, txManagerService } = setup();
    const addresses = [createAkashAddress(), createAkashAddress()];
    txManagerService.getFundingWalletAddresses.mockResolvedValue(addresses);

    await expect(controller.getFundingWalletAddresses()).resolves.toEqual({ data: { addresses } });
  });

  it("returns the address of the user wallet at the index and of the generation asked for", async () => {
    const { controller, txManagerService } = setup();
    const address = createAkashAddress();
    txManagerService.getDerivedWalletAddress.mockResolvedValue(address);

    await expect(controller.getDerivedWalletAddress(12, "v1")).resolves.toEqual({ data: { address } });
    expect(txManagerService.getDerivedWalletAddress).toHaveBeenCalledWith(12, "v1");
  });

  it("issues a provider token for the wallet, access and lifetime asked for", async () => {
    const { controller, providerTokenService } = setup();
    const leases = { access: "granular" as const, permissions: [{ provider: createAkashAddress(), access: "full" as const }] };
    providerTokenService.issue.mockResolvedValue("signed-token");

    await expect(controller.issueProviderToken({ data: { derivationIndex: 4, leases, ttl: 60 } })).resolves.toEqual({ data: { token: "signed-token" } });
    expect(providerTokenService.issue).toHaveBeenCalledWith({ derivationIndex: 4, leases, ttl: 60 });
  });

  function setup() {
    const txManagerService = mock<TxManagerService>();
    const providerTokenService = mock<ProviderTokenService>();

    return { controller: new WalletController(txManagerService, providerTokenService), txManagerService, providerTokenService };
  }
});
