import type dns from "node:dns";
import { describe, expect, it } from "vitest";

import { assertPublicHost, createForbidPrivateNetworkLookup } from "./private-network";

describe("private-network", () => {
  describe(createForbidPrivateNetworkLookup.name, () => {
    it.each([
      ["10.0.0.5", 4],
      ["100.64.1.1", 4],
      ["127.0.0.1", 4],
      ["169.254.169.254", 4],
      ["172.16.0.1", 4],
      ["192.168.1.1", 4],
      ["::1", 6],
      ["fd00::1", 6],
      ["fe80::1", 6]
    ])("refuses a host that resolves to %s", async (address, family) => {
      const lookup = createForbidPrivateNetworkLookup(resolvingTo([{ address, family }]));

      await expect(lookupAll(lookup, "provider.example.com")).rejects.toMatchObject({
        code: "EFORBIDDEN",
        message: `Hostname provider.example.com resolved to forbidden address ${address}`
      });
    });

    it("refuses a host when any of its addresses is private", async () => {
      const lookup = createForbidPrivateNetworkLookup(
        resolvingTo([
          { address: "203.0.113.10", family: 4 },
          { address: "10.0.0.5", family: 4 }
        ])
      );

      await expect(lookupAll(lookup, "provider.example.com")).rejects.toMatchObject({ code: "EFORBIDDEN" });
    });

    it("returns every address of a public host when all addresses are asked for", async () => {
      const addresses = [
        { address: "203.0.113.10", family: 4 },
        { address: "2001:db8::1", family: 6 }
      ];
      const lookup = createForbidPrivateNetworkLookup(resolvingTo(addresses));

      await expect(lookupAll(lookup, "provider.example.com")).resolves.toEqual(addresses);
    });

    it("returns the first address of a public host when one address is asked for", async () => {
      const lookup = createForbidPrivateNetworkLookup(
        resolvingTo([
          { address: "203.0.113.10", family: 4 },
          { address: "203.0.113.11", family: 4 }
        ])
      );

      const result = await new Promise((resolve, reject) =>
        lookup("provider.example.com", {}, (err, address, family) => (err ? reject(err) : resolve({ address, family })))
      );

      expect(result).toEqual({ address: "203.0.113.10", family: 4 });
    });

    it("passes a resolution failure through", async () => {
      const failure: NodeJS.ErrnoException = Object.assign(new Error("not found"), { code: "ENOTFOUND" });
      const lookup = createForbidPrivateNetworkLookup((_hostname, _options, callback) => callback(failure, []));

      await expect(lookupAll(lookup, "missing.example.com")).rejects.toBe(failure);
    });
  });

  describe(assertPublicHost.name, () => {
    it("refuses an IPv4 loopback literal", async () => {
      await expect(assertPublicHost("http://127.0.0.1:8443")).rejects.toMatchObject({ code: "EFORBIDDEN" });
    });

    it("refuses an IPv6 loopback literal", async () => {
      await expect(assertPublicHost("https://[::1]:8443")).rejects.toMatchObject({ code: "EFORBIDDEN" });
    });

    it("refuses a cloud metadata address", async () => {
      await expect(assertPublicHost("http://169.254.169.254/latest")).rejects.toMatchObject({ code: "EFORBIDDEN" });
    });

    it("accepts a public IPv4 literal", async () => {
      await expect(assertPublicHost("https://203.0.113.10:8443")).resolves.toBeUndefined();
    });

    it("checks a name through the lookup it is given", async () => {
      const lookup = createForbidPrivateNetworkLookup(resolvingTo([{ address: "10.0.0.5", family: 4 }]));

      await expect(assertPublicHost("https://provider.example.com:8443", lookup)).rejects.toMatchObject({ code: "EFORBIDDEN" });
    });

    it("accepts a name the lookup resolves to a public address", async () => {
      const lookup = createForbidPrivateNetworkLookup(resolvingTo([{ address: "203.0.113.10", family: 4 }]));

      await expect(assertPublicHost("https://provider.example.com:8443", lookup)).resolves.toBeUndefined();
    });
  });
});

function resolvingTo(addresses: dns.LookupAddress[]) {
  return (_hostname: string, _options: dns.LookupAllOptions, callback: (err: NodeJS.ErrnoException | null, addresses: dns.LookupAddress[]) => void) =>
    callback(null, addresses);
}

function lookupAll(lookup: ReturnType<typeof createForbidPrivateNetworkLookup>, hostname: string) {
  return new Promise((resolve, reject) => lookup(hostname, { all: true }, (err, addresses) => (err ? reject(err) : resolve(addresses))));
}
