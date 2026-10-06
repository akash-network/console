import type { NetworkStore } from "@akashnetwork/network-store";
import { toBech32 } from "@cosmjs/encoding";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { BrowserFavoriteProvidersService } from "./browser-favorite-providers.service";

const FIRST = toBech32("akash", new Uint8Array(20).fill(1));
const SECOND = toBech32("akash", new Uint8Array(20).fill(2));

describe(BrowserFavoriteProvidersService.name, () => {
  describe("read", () => {
    it("reads the favorites stored for the selected network", () => {
      const { service } = setup({
        "mainnet/provider.data": JSON.stringify({ favorites: [FIRST, SECOND] }),
        "testnet/provider.data": JSON.stringify({ favorites: [] })
      });

      expect(service.read()).toEqual([FIRST, SECOND]);
    });

    it("skips an entry the api would refuse and one listed twice", () => {
      const { service } = setup({
        "mainnet/provider.data": JSON.stringify({ favorites: [FIRST, toBech32("cosmos", new Uint8Array(20).fill(3)), "akash1typo", 42, null, FIRST] })
      });

      expect(service.read()).toEqual([FIRST]);
    });

    it.each([
      ["nothing stored", undefined],
      ["an unreadable entry", "{not json"],
      ["an entry without favorites", JSON.stringify({ other: true })],
      ["favorites that are not a list", JSON.stringify({ favorites: FIRST })],
      ["a null entry", "null"]
    ])("reads no favorite from %s", (_case, stored) => {
      const { service } = setup(stored === undefined ? {} : { "mainnet/provider.data": stored });

      expect(service.read()).toEqual([]);
    });
  });

  describe("forget", () => {
    it("forgets the selected network's favorites only", () => {
      const { service, entries } = setup({
        "mainnet/provider.data": JSON.stringify({ favorites: [FIRST] }),
        "testnet/provider.data": JSON.stringify({ favorites: [] })
      });

      service.forget();

      expect([...entries.keys()]).toEqual(["testnet/provider.data"]);
    });
  });

  function setup(stored: Record<string, string>) {
    const entries = new Map(Object.entries(stored));
    const storage: Storage = {
      get length() {
        return entries.size;
      },
      key: index => [...entries.keys()][index] ?? null,
      getItem: key => entries.get(key) ?? null,
      setItem: (key, value) => {
        entries.set(key, value);
      },
      removeItem: key => {
        entries.delete(key);
      },
      clear: () => entries.clear()
    };
    const service = new BrowserFavoriteProvidersService(storage, mock<NetworkStore>({ selectedNetworkId: "mainnet" }));

    return { service, entries };
  }
});
