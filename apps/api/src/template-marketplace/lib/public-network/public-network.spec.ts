import type dns from "node:dns";
import { describe, expect, it, vi } from "vitest";

import { createPublicNetworkLookup, FORBIDDEN_ADDRESS_ERROR_CODE, isPublicAddress } from "./public-network";

type LookupAnswer = { error?: NodeJS.ErrnoException; addresses?: dns.LookupAddress[] };

describe(isPublicAddress.name, () => {
  it.each([
    "0.0.0.0",
    "10.0.0.1",
    "10.255.255.255",
    "100.64.0.1",
    "100.100.100.200",
    "127.0.0.1",
    "127.255.255.254",
    "169.254.169.254",
    "169.254.170.2",
    "172.16.0.1",
    "172.31.255.255",
    "192.0.0.8",
    "192.0.2.1",
    "192.168.1.1",
    "198.18.0.1",
    "198.51.100.7",
    "203.0.113.7",
    "224.0.0.1",
    "255.255.255.255",
    "::",
    "::1",
    "::ffff:127.0.0.1",
    "::ffff:10.0.0.1",
    "::ffff:169.254.169.254",
    "::ffff:a9fe:a9fe",
    "64:ff9b::a00:1",
    "64:ff9b:1::1",
    "2001::1",
    "2001:db8::1",
    "2002:a00:1::1",
    "fc00::1",
    "fd00:ec2::254",
    "fe80::1",
    "febf::1",
    "ff02::1"
  ])("refuses %s", address => {
    expect(isPublicAddress(address)).toBe(false);
  });

  it.each(["1.1.1.1", "8.8.8.8", "100.63.255.255", "100.128.0.1", "172.15.255.255", "172.32.0.1", "192.169.0.1", "2606:4700:4700::1111", "::ffff:8.8.8.8"])(
    "accepts %s",
    address => {
      expect(isPublicAddress(address)).toBe(true);
    }
  );

  it.each(["", "example.com", "999.1.1.1", "1.1.1"])("refuses %j, which is no address", address => {
    expect(isPublicAddress(address)).toBe(false);
  });
});

describe(createPublicNetworkLookup.name, () => {
  it("hands the socket the address of a public host", async () => {
    const { lookup, baseLookup } = setup({ addresses: [{ address: "1.1.1.1", family: 4 }] });

    expect(await lookup("registry.example.com", { family: 0 })).toEqual({ error: null, address: "1.1.1.1", family: 4 });
    expect(baseLookup).toHaveBeenCalledWith("registry.example.com", { family: 0, all: true }, expect.any(Function));
  });

  it("hands over every address when the socket asks for all of them", async () => {
    const addresses = [
      { address: "2606:4700:4700::1111", family: 6 },
      { address: "1.1.1.1", family: 4 }
    ];
    const { lookup } = setup({ addresses });

    expect(await lookup("registry.example.com", { all: true })).toEqual({ error: null, address: addresses, family: undefined });
  });

  it.each([
    { name: "a loopback address", addresses: [{ address: "127.0.0.1", family: 4 }], refused: "127.0.0.1" },
    { name: "the cloud metadata address", addresses: [{ address: "169.254.169.254", family: 4 }], refused: "169.254.169.254" },
    { name: "a unique-local IPv6 address", addresses: [{ address: "fd00::1", family: 6 }], refused: "fd00::1" },
    { name: "an IPv4-mapped private address", addresses: [{ address: "::ffff:10.0.0.1", family: 6 }], refused: "::ffff:10.0.0.1" },
    {
      name: "a private address behind a public one",
      addresses: [
        { address: "1.1.1.1", family: 4 },
        { address: "10.0.0.1", family: 4 }
      ],
      refused: "10.0.0.1"
    },
    { name: "no address at all", addresses: [], refused: "no address" }
  ])("refuses a host that resolves to $name, whether one address or all are asked for", async ({ addresses, refused }) => {
    const { lookup } = setup({ addresses });

    for (const options of [{}, { all: true }]) {
      const answer = await lookup("rebind.example.com", options);

      expect(answer).toMatchObject({ address: "", error: { code: FORBIDDEN_ADDRESS_ERROR_CODE } });
      expect(answer.error?.message).toBe(`Hostname rebind.example.com resolved to ${refused}, which is not a public address`);
    }
  });

  it("passes on a failed lookup", async () => {
    const error = Object.assign(new Error("getaddrinfo ENOTFOUND"), { code: "ENOTFOUND" });
    const { lookup } = setup({ error });

    expect(await lookup("missing.example.com", {})).toEqual({ error, address: "", family: undefined });
  });

  function setup(answer: LookupAnswer) {
    const baseLookup = vi.fn(
      (_hostname: string, _options: dns.LookupAllOptions, callback: (error: NodeJS.ErrnoException | null, addresses: dns.LookupAddress[]) => void) =>
        callback(answer.error ?? null, answer.addresses ?? [])
    );
    const guarded = createPublicNetworkLookup(baseLookup);
    const lookup = (hostname: string, options: dns.LookupOptions) =>
      new Promise<{ error: NodeJS.ErrnoException | null; address: string | dns.LookupAddress[]; family: number | undefined }>(resolve => {
        guarded(hostname, options, (error, address, family) => resolve({ error, address, family }));
      });

    return { lookup, baseLookup };
  }
});
