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

  it.each(["v1", "v3", "v12"])("asks for seed version %s of a derived wallet when it is named", async version => {
    const { controller } = setup();
    controller.getDerivedWalletAddress.mockResolvedValue({ data: { address: "akash1derived" } });

    await walletRouter.request(`/v1/wallets/derived/0?version=${version}`);

    expect(controller.getDerivedWalletAddress).toHaveBeenCalledWith(0, version);
  });

  it("serves the highest index that still derives an ordinary wallet", async () => {
    const { controller } = setup();
    controller.getDerivedWalletAddress.mockResolvedValue({ data: { address: "akash1derived" } });

    const response = await walletRouter.request("/v1/wallets/derived/2147483647");

    expect(response.status).toBe(200);
    expect(controller.getDerivedWalletAddress).toHaveBeenCalledWith(2147483647, "v2");
  });

  it.each([
    ["a negative index", "/v1/wallets/derived/-1"],
    ["an index that would derive a hardened key", "/v1/wallets/derived/2147483648"],
    ["a fractional index", "/v1/wallets/derived/1.5"],
    ["an index that is not a number", "/v1/wallets/derived/first"],
    ["a seed version numbered zero", "/v1/wallets/derived/1?version=v0"],
    ["a seed version without its prefix", "/v1/wallets/derived/1?version=3"],
    ["a seed version with text after it", "/v1/wallets/derived/1?version=v3x"],
    ["a seed version with text before it", "/v1/wallets/derived/1?version=xv3"]
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
    ["full access", { access: "full" }],
    ["access scoped to some actions on every provider", { access: "scoped", scope: ["status", "logs"] }],
    ["access spelled out per provider", { access: "granular", permissions: [{ provider: "akash1provider", access: "full" }] }]
  ])("passes on a provider token request for %s", async (_case, leases) => {
    const { controller } = setup();
    const data = { derivationIndex: 2147483647, leases, ttl: 30 };
    controller.issueProviderToken.mockResolvedValue({ data: { token: "signed-token" } });

    const response = await postProviderToken(data);

    expect(response.status).toBe(200);
    expect(controller.issueProviderToken).toHaveBeenCalledWith({ data });
  });

  it("passes on the seed version a provider token request names", async () => {
    const { controller } = setup();
    const data = { derivationIndex: 3, seedVersion: "v3", leases: { access: "full" }, ttl: 30 };
    controller.issueProviderToken.mockResolvedValue({ data: { token: "signed-token" } });

    await postProviderToken(data);

    expect(controller.issueProviderToken).toHaveBeenCalledWith({ data });
  });

  it("rejects a provider token request that does not say it is json, rather than failing on it", async () => {
    const { controller } = setup();

    const response = await walletRouter.request("/v1/wallets/provider-tokens", {
      method: "POST",
      body: JSON.stringify({ data: { derivationIndex: 3, leases: { access: "full" }, ttl: 30 } })
    });

    expect(response.status).toBe(400);
    expect(controller.issueProviderToken).not.toHaveBeenCalled();
  });

  it.each([
    ["no access", { derivationIndex: 3, ttl: 30 }],
    ["a seed version that is not one", { derivationIndex: 3, seedVersion: "latest", leases: { access: "full" }, ttl: 30 }],
    ["a wallet index that would derive a hardened key", { derivationIndex: 2147483648, leases: { access: "full" }, ttl: 30 }],
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
