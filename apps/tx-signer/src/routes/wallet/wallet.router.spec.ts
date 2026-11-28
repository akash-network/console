import { container } from "tsyringe";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { WalletController } from "@src/controllers/wallet/wallet.controller";
import { walletRouter } from "./wallet.router";

describe("walletRouter", () => {
  it("answers with the funding wallet addresses", async () => {
    const { controller } = setup();
    controller.getFundingWalletAddresses.mockResolvedValue({ data: { addresses: ["akash1funding"] } });

    const response = await walletRouter.request("/v1/wallets/funding");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { addresses: ["akash1funding"] } });
  });

  it("asks for the current generation of a derived wallet unless another is named", async () => {
    const { controller } = setup();
    controller.getDerivedWalletAddress.mockResolvedValue({ data: { address: "akash1derived" } });

    const response = await walletRouter.request("/v1/wallets/derived/12");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { address: "akash1derived" } });
    expect(controller.getDerivedWalletAddress).toHaveBeenCalledWith(12, "v2");
  });

  it("asks for the first generation of a derived wallet when it is named", async () => {
    const { controller } = setup();
    controller.getDerivedWalletAddress.mockResolvedValue({ data: { address: "akash1derived" } });

    await walletRouter.request("/v1/wallets/derived/0?version=v1");

    expect(controller.getDerivedWalletAddress).toHaveBeenCalledWith(0, "v1");
  });

  it.each([
    ["a negative index", "/v1/wallets/derived/-1"],
    ["a fractional index", "/v1/wallets/derived/1.5"],
    ["an index that is not a number", "/v1/wallets/derived/first"],
    ["a generation that does not exist", "/v1/wallets/derived/1?version=v3"]
  ])("rejects %s", async (_case, path) => {
    const { controller } = setup();

    const response = await walletRouter.request(path);

    expect(response.status).toBe(400);
    expect(controller.getDerivedWalletAddress).not.toHaveBeenCalled();
  });

  it("issues a provider token for the request it is given", async () => {
    const { controller } = setup();
    const data = { derivationIndex: 3, leases: { access: "granular", permissions: [{ provider: "akash1provider", access: "full" }] }, ttl: 30 };
    controller.issueProviderToken.mockResolvedValue({ data: { token: "signed-token" } });

    const response = await postProviderToken(data);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { token: "signed-token" } });
    expect(controller.issueProviderToken).toHaveBeenCalledWith({ data });
  });

  it.each([
    ["no access", { derivationIndex: 3, ttl: 30 }],
    ["access of an unknown kind", { derivationIndex: 3, leases: { access: "everything" }, ttl: 30 }],
    ["no wallet index", { leases: { access: "full" }, ttl: 30 }],
    ["a negative wallet index", { derivationIndex: -1, leases: { access: "full" }, ttl: 30 }],
    ["a fractional wallet index", { derivationIndex: 1.5, leases: { access: "full" }, ttl: 30 }],
    ["no lifetime", { derivationIndex: 3, leases: { access: "full" } }],
    ["a lifetime of zero", { derivationIndex: 3, leases: { access: "full" }, ttl: 0 }],
    ["a fractional lifetime", { derivationIndex: 3, leases: { access: "full" }, ttl: 0.5 }]
  ])("rejects a provider token request with %s", async (_case, data) => {
    const { controller } = setup();

    const response = await postProviderToken(data);

    expect(response.status).toBe(400);
    expect(controller.issueProviderToken).not.toHaveBeenCalled();
  });

  function postProviderToken(data: Record<string, unknown>) {
    return walletRouter.request("/v1/wallets/provider-tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data })
    });
  }

  function setup() {
    const controller = mock<WalletController>();
    container.registerInstance(WalletController, controller);

    return { controller };
  }
});
