import type dns from "node:dns";
import net from "node:net";
import { describe, expect, it, vi } from "vitest";

import { createForbidPrivateNetworkLookup, PRIVATE_NETWORK_BLOCK_LIST } from "./createForbidPrivateNetworkLookup";

describe(createForbidPrivateNetworkLookup.name, () => {
  describe("rejects IPv4 addresses inside forbidden ranges", () => {
    const FORBIDDEN_IPV4 = [
      ["0.0.0.0/8", "0.0.0.1"],
      ["10.0.0.0/8 (RFC1918)", "10.5.5.5"],
      ["100.64.0.0/10 (CGNAT)", "100.64.1.1"],
      ["127.0.0.0/8 (loopback)", "127.0.0.1"],
      ["169.254.0.0/16 (link-local)", "169.254.169.254"],
      ["172.16.0.0/12 (RFC1918)", "172.20.0.1"],
      ["192.168.0.0/16 (RFC1918)", "192.168.1.1"],
      ["255.255.255.255 (broadcast)", "255.255.255.255"]
    ] as const;

    it.each(FORBIDDEN_IPV4)("rejects %s — %s", async (_label, address) => {
      const { lookup } = setup({ resolvedAs: [{ address, family: 4 }] });
      const result = await lookup("evil.example.com");

      expect(result.err?.code).toBe("EFORBIDDEN");
      expect(result.err?.message).toContain(address);
    });
  });

  describe("rejects IPv6 addresses inside forbidden ranges", () => {
    const FORBIDDEN_IPV6 = [
      ["unspecified ::", "::"],
      ["loopback ::1", "::1"],
      ["ULA fc00::/7", "fc00::1"],
      ["ULA fd00::/8 (within fc00::/7)", "fd12:3456:789a::1"],
      ["link-local fe80::/10", "fe80::1"]
    ] as const;

    it.each(FORBIDDEN_IPV6)("rejects %s — %s", async (_label, address) => {
      const { lookup } = setup({ resolvedAs: [{ address, family: 6 }] });
      const result = await lookup("evil.example.com");

      expect(result.err?.code).toBe("EFORBIDDEN");
      expect(result.err?.message).toContain(address);
    });
  });

  describe("passes public addresses through", () => {
    it("forwards a public IPv4 address to the callback in single-result mode", async () => {
      const { lookup } = setup({ resolvedAs: [{ address: "1.1.1.1", family: 4 }] });
      const result = await lookup("one.one.one.one");

      expect(result.err).toBeNull();
      expect(result.address).toBe("1.1.1.1");
      expect(result.family).toBe(4);
    });

    it("forwards a public IPv6 address to the callback in single-result mode", async () => {
      const { lookup } = setup({ resolvedAs: [{ address: "2606:4700:4700::1111", family: 6 }] });
      const result = await lookup("one.one.one.one");

      expect(result.err).toBeNull();
      expect(result.address).toBe("2606:4700:4700::1111");
      expect(result.family).toBe(6);
    });

    it("returns the full address list when options.all is true", async () => {
      const addresses = [
        { address: "1.1.1.1", family: 4 },
        { address: "2606:4700:4700::1111", family: 6 }
      ];
      const { lookup } = setup({ resolvedAs: addresses });
      const result = await lookup("one.one.one.one", { all: true });

      expect(result.err).toBeNull();
      expect(result.address).toEqual(addresses);
    });
  });

  describe("fail-closed on mixed results", () => {
    it("rejects when any of the resolved addresses is forbidden", async () => {
      const { lookup } = setup({
        resolvedAs: [
          { address: "1.1.1.1", family: 4 },
          { address: "10.0.0.1", family: 4 }
        ]
      });
      const result = await lookup("rebinding.example.com");

      expect(result.err?.code).toBe("EFORBIDDEN");
      expect(result.err?.message).toContain("10.0.0.1");
    });

    it("rejects when a public IPv6 address is paired with a private IPv4 address", async () => {
      const { lookup } = setup({
        resolvedAs: [
          { address: "2606:4700:4700::1111", family: 6 },
          { address: "192.168.1.1", family: 4 }
        ]
      });
      const result = await lookup("rebinding.example.com");

      expect(result.err?.code).toBe("EFORBIDDEN");
      expect(result.err?.message).toContain("192.168.1.1");
    });
  });

  describe("forwards DNS errors", () => {
    it("propagates an underlying lookup error without modification", async () => {
      const lookupError: NodeJS.ErrnoException = new Error("getaddrinfo ENOTFOUND nonexistent.example.com");
      lookupError.code = "ENOTFOUND";

      const { lookup } = setup({ lookupError });
      const result = await lookup("nonexistent.example.com");

      expect(result.err).toBe(lookupError);
    });
  });

  describe("defaults", () => {
    it("uses PRIVATE_NETWORK_BLOCK_LIST when no block list is supplied", () => {
      expect(PRIVATE_NETWORK_BLOCK_LIST.check("127.0.0.1", "ipv4")).toBe(true);
      expect(PRIVATE_NETWORK_BLOCK_LIST.check("10.0.0.1", "ipv4")).toBe(true);
      expect(PRIVATE_NETWORK_BLOCK_LIST.check("::1", "ipv6")).toBe(true);
      expect(PRIVATE_NETWORK_BLOCK_LIST.check("1.1.1.1", "ipv4")).toBe(false);
      expect(PRIVATE_NETWORK_BLOCK_LIST.check("2606:4700:4700::1111", "ipv6")).toBe(false);
    });

    it("does not call the wrapped lookup when a permissive block list is supplied", async () => {
      const baseLookup = vi.fn((_hostname, _opts, cb) => cb(null, [{ address: "10.0.0.1", family: 4 }]));
      const lookup = createForbidPrivateNetworkLookup(baseLookup, new net.BlockList());
      const result = await new Promise<{ err: NodeJS.ErrnoException | null; address: string | dns.LookupAddress[]; family?: number }>(resolve =>
        lookup("anywhere.example.com", {}, (err, address, family) => resolve({ err, address, family }))
      );

      expect(result.err).toBeNull();
      expect(result.address).toBe("10.0.0.1");
      expect(baseLookup).toHaveBeenCalledOnce();
    });
  });

  function setup(input: { resolvedAs?: dns.LookupAddress[]; lookupError?: NodeJS.ErrnoException }) {
    const baseLookup = vi.fn(
      (_hostname: string, _options: dns.LookupAllOptions, callback: (err: NodeJS.ErrnoException | null, addresses: dns.LookupAddress[]) => void) => {
        if (input.lookupError) return callback(input.lookupError, []);
        callback(null, input.resolvedAs ?? []);
      }
    );

    const forbidLookup = createForbidPrivateNetworkLookup(baseLookup);

    const lookup = (hostname: string, options: dns.LookupOptions = {}) =>
      new Promise<{ err: NodeJS.ErrnoException | null; address: string | dns.LookupAddress[]; family?: number }>(resolve =>
        forbidLookup(hostname, options, (err, address, family) => resolve({ err, address, family }))
      );

    return { lookup, baseLookup };
  }
});
