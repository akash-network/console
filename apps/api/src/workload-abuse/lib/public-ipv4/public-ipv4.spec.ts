import { describe, expect, it } from "vitest";

import { isPublicIpv4 } from "./public-ipv4";

describe(isPublicIpv4.name, () => {
  it("accepts a routable address", () => {
    expect(isPublicIpv4("23.88.114.19")).toBe(true);
    expect(isPublicIpv4("138.197.228.18")).toBe(true);
  });

  it.each([
    "0.0.0.0",
    "10.1.2.3",
    "100.64.0.1",
    "127.0.0.1",
    "169.254.1.1",
    "172.16.0.1",
    "172.31.255.255",
    "192.0.0.8",
    "192.0.2.1",
    "192.168.1.1",
    "198.18.0.1",
    "198.19.255.255",
    "198.51.100.7",
    "203.0.113.9",
    "224.0.0.1",
    "255.255.255.255"
  ])("rejects the non-public address %s", address => {
    expect(isPublicIpv4(address)).toBe(false);
  });

  it("accepts the routable neighbours of the reserved ranges", () => {
    expect(isPublicIpv4("100.128.0.1")).toBe(true);
    expect(isPublicIpv4("172.32.0.1")).toBe(true);
    expect(isPublicIpv4("198.20.0.1")).toBe(true);
    expect(isPublicIpv4("223.255.255.255")).toBe(true);
  });

  it("rejects anything that is not an IPv4 address", () => {
    expect(isPublicIpv4("2001:db8::1")).toBe(false);
    expect(isPublicIpv4("mail.example.com")).toBe(false);
  });
});
