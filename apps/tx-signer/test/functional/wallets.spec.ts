import type { JwtTokenPayload } from "@akashnetwork/chain-sdk";
import { makeSignDoc, serializeSignDoc } from "@cosmjs/amino";
import { Secp256k1, Secp256k1Signature, sha256 } from "@cosmjs/crypto";
import { toBase64, toUtf8 } from "@cosmjs/encoding";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { WalletController } from "@src/controllers/wallet/wallet.controller";
import { app } from "@src/index";
import { AppConfigService } from "@src/services/app-config/app-config.service";
import { TxManagerService } from "@src/services/tx-manager/tx-manager.service";

import { createAkashAddress } from "@test/seeders";

const DERIVATION_INDEX = 3;

describe(WalletController.name, () => {
  describe("GET /v1/wallets/funding", () => {
    it("lists the seed phrase funding wallet first and the key service one after it", async () => {
      const res = await app.request("/v1/wallets/funding", { headers: authorizedHeaders() });

      expect(res.status).toBe(200);
      const { data } = (await res.json()) as { data: { addresses: string[] } };
      expect(data.addresses).toEqual(await container.resolve(TxManagerService).getFundingWalletAddresses());
      expect(data.addresses).toHaveLength(2);
      expect(new Set(data.addresses).size).toBe(2);
    });

    it("answers nothing without the api key", async () => {
      const res = await app.request("/v1/wallets/funding");

      expect(res.status).toBe(401);
    });
  });

  describe("GET /v1/wallets/derived/{index}", () => {
    it("returns the address the wallet at that index signs transactions with", async () => {
      const res = await app.request(`/v1/wallets/derived/${DERIVATION_INDEX}`, { headers: authorizedHeaders() });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ data: { address: await signingAddressOf(DERIVATION_INDEX) } });
    });

    it("returns a different address for each index", async () => {
      const [first, second] = await Promise.all([readDerivedAddress("1"), readDerivedAddress("2")]);

      expect(first).toMatch(/^akash1/);
      expect(second).toMatch(/^akash1/);
      expect(first).not.toBe(second);
    });

    it("returns the first-generation address of an index, which is not the address it signs with now", async () => {
      const firstGeneration = await readDerivedAddress(`${DERIVATION_INDEX}?version=v1`);

      expect(firstGeneration).toMatch(/^akash1/);
      expect(firstGeneration).not.toBe(await signingAddressOf(DERIVATION_INDEX));
    });

    it("returns the address of an index under a seed that reached the signer encrypted, unlike its address under the current seed", async () => {
      const added = await readDerivedAddress(`${DERIVATION_INDEX}?version=v3`);

      expect(added).toBe(await signingAddressOf(DERIVATION_INDEX, "v3"));
      expect(added).not.toBe(await signingAddressOf(DERIVATION_INDEX));
    });

    it("answers that it holds no such seed for a version it was not given", async () => {
      const res = await app.request(`/v1/wallets/derived/${DERIVATION_INDEX}?version=v9`, { headers: authorizedHeaders() });

      expect(res.status).toBe(501);
      expect(await res.json()).toMatchObject({ message: "This signer holds no derivation seed v9" });
    });

    it("answers nothing without the api key", async () => {
      const res = await app.request(`/v1/wallets/derived/${DERIVATION_INDEX}`);

      expect(res.status).toBe(401);
    });
  });

  describe("POST /v1/wallets/provider-tokens", () => {
    it("issues a token the wallet at that index signed, limited to the access asked for", async () => {
      const leases = { access: "granular", permissions: [{ provider: createAkashAddress(), access: "scoped", scope: ["status", "logs"] }] };
      const issuedNoEarlierThan = Math.floor(Date.now() / 1000);

      const res = await postProviderToken({ derivationIndex: DERIVATION_INDEX, leases, ttl: 120 });

      expect(res.status).toBe(200);
      const { token } = ((await res.json()) as { data: { token: string } }).data;
      const payload = decode(token);
      expect(payload).toMatchObject({ version: "v1", iss: await signingAddressOf(DERIVATION_INDEX), leases, exp: payload.iat + 120 });
      expect(payload.iat).toBeGreaterThanOrEqual(issuedNoEarlierThan);
      await expect(isSignedBy(token, DERIVATION_INDEX)).resolves.toBe(true);
      await expect(isSignedBy(token, DERIVATION_INDEX + 1)).resolves.toBe(false);
    });

    it("issues a token signed by the wallet of the seed version asked for", async () => {
      const res = await postProviderToken({ derivationIndex: DERIVATION_INDEX, seedVersion: "v3", leases: { access: "full" }, ttl: 120 });

      expect(res.status).toBe(200);
      const { token } = ((await res.json()) as { data: { token: string } }).data;
      expect(decode(token).iss).toBe(await signingAddressOf(DERIVATION_INDEX, "v3"));
      await expect(isSignedBy(token, DERIVATION_INDEX, "v3")).resolves.toBe(true);
      await expect(isSignedBy(token, DERIVATION_INDEX)).resolves.toBe(false);
    });

    it("issues no token in the name of a first-generation wallet, whose seed only answers addresses", async () => {
      const res = await postProviderToken({ derivationIndex: DERIVATION_INDEX, seedVersion: "v1", leases: { access: "full" }, ttl: 120 });

      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({ message: "Derivation seed v1 only answers addresses, so nothing is signed with it" });
    });

    it("refuses access the provider token format does not allow", async () => {
      const res = await postProviderToken({ derivationIndex: DERIVATION_INDEX, leases: { access: "granular", permissions: [] }, ttl: 120 });

      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ message: expect.stringContaining("The provider token asked for is not valid") });
    });

    it("issues nothing without the api key", async () => {
      const res = await postProviderToken(
        { derivationIndex: DERIVATION_INDEX, leases: { access: "full" }, ttl: 120 },
        new Headers({ "Content-Type": "application/json" })
      );

      expect(res.status).toBe(401);
    });
  });

  function authorizedHeaders() {
    return new Headers({ "Content-Type": "application/json", "x-api-key": container.resolve(AppConfigService).get("ACCESS_API_KEY") });
  }

  function postProviderToken(data: Record<string, unknown>, headers: Headers = authorizedHeaders()) {
    return app.request("/v1/wallets/provider-tokens", { method: "POST", body: JSON.stringify({ data }), headers });
  }

  async function readDerivedAddress(indexAndQuery: string) {
    const res = await app.request(`/v1/wallets/derived/${indexAndQuery}`, { headers: authorizedHeaders() });

    return ((await res.json()) as { data: { address: string } }).data.address;
  }

  function signingAddressOf(derivationIndex: number, seedVersion?: string) {
    return container.resolve(TxManagerService).getDerivedWalletAddress(derivationIndex, seedVersion);
  }

  function decode(token: string): JwtTokenPayload {
    return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
  }

  async function isSignedBy(token: string, derivationIndex: number, seedVersion?: string) {
    const [header, payload, signature] = token.split(".");
    const [{ address, pubkey }] = await container.resolve(TxManagerService).getDerivedWallet(derivationIndex, seedVersion).getAccounts();
    const signedData = { type: "sign/MsgSignData", value: { signer: address, data: toBase64(toUtf8(`${header}.${payload}`)) } };
    const signDoc = makeSignDoc([signedData], { gas: "0", amount: [] }, "", "", "0", "0");

    return await Secp256k1.verifySignature(Secp256k1Signature.fromFixedLength(Buffer.from(signature, "base64url")), sha256(serializeSignDoc(signDoc)), pubkey);
  }
});
