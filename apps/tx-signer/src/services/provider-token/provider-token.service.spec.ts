import type { JwtTokenPayload } from "@akashnetwork/chain-sdk";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { Wallet } from "@src/lib/wallet/wallet";
import type { TxManagerService } from "@src/services/tx-manager/tx-manager.service";
import { ProviderTokenService } from "./provider-token.service";

import { createAkashAddress } from "@test/seeders";

describe(ProviderTokenService.name, () => {
  it("issues a token in the name of the wallet at the index asked for, carrying the access asked for", async () => {
    const { service, addressOf } = setup();
    const leases: JwtTokenPayload["leases"] = { access: "granular", permissions: [{ provider: createAkashAddress(), access: "scoped", scope: ["logs"] }] };
    const issuedNoEarlierThan = Math.floor(Date.now() / 1000);

    const payload = decode(await service.issue({ derivationIndex: 7, leases, ttl: 45 }));

    expect(payload).toEqual({
      version: "v1",
      iss: await addressOf(7),
      iat: expect.any(Number),
      nbf: payload.iat,
      exp: payload.iat + 45,
      jti: expect.stringMatching(/^[0-9a-f-]{36}$/),
      leases
    });
    expect(payload.iat).toBeGreaterThanOrEqual(issuedNoEarlierThan);
    expect(payload.iat).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));
  });

  it("signs every token it issues", async () => {
    const { service } = setup();

    const [header, , signature] = (await service.issue({ derivationIndex: 1, leases: { access: "full" }, ttl: 30 })).split(".");

    expect(JSON.parse(Buffer.from(header, "base64url").toString())).toEqual({ alg: "ES256KADR36", typ: "JWT" });
    expect(Buffer.from(signature, "base64url")).toHaveLength(64);
  });

  it("gives each token its own id", async () => {
    const { service } = setup();

    const first = decode(await service.issue({ derivationIndex: 1, leases: { access: "full" }, ttl: 30 }));
    const second = decode(await service.issue({ derivationIndex: 1, leases: { access: "full" }, ttl: 30 }));

    expect(first.jti).not.toBe(second.jti);
  });

  it("derives a wallet once however many tokens are issued in its name", async () => {
    const { service, txManagerService } = setup();

    await service.issue({ derivationIndex: 1, leases: { access: "full" }, ttl: 30 });
    await service.issue({ derivationIndex: 1, leases: { access: "full" }, ttl: 30 });
    await service.issue({ derivationIndex: 2, leases: { access: "full" }, ttl: 30 });

    expect(txManagerService.getDerivedWallet.mock.calls).toEqual([[1], [2]]);
  });

  it("refuses access the provider token format does not allow, naming what is wrong with it", async () => {
    const { service } = setup();
    const leases = { access: "granular", permissions: [] } as JwtTokenPayload["leases"];

    await expect(service.issue({ derivationIndex: 1, leases, ttl: 30 })).rejects.toMatchObject({
      status: 400,
      message: expect.stringMatching(/^The provider token asked for is not valid: .*permissions/)
    });
  });

  function decode(token: string): JwtTokenPayload {
    return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
  }

  function setup() {
    const walletsByIndex = new Map<number, Wallet>();
    const walletAt = (index: number) => {
      if (!walletsByIndex.has(index)) walletsByIndex.set(index, new Wallet());

      return walletsByIndex.get(index)!;
    };
    const txManagerService = mock<TxManagerService>();
    txManagerService.getDerivedWallet.mockImplementation(walletAt);

    return {
      service: new ProviderTokenService(txManagerService),
      txManagerService,
      addressOf: (index: number) => walletAt(index).getFirstAddress()
    };
  }
});
