import { BlockList, isIPv4 } from "node:net";

/** A placeholder such as 127.0.0.1 is set on many unrelated domains, so a shared one says nothing about who runs them. */
const NON_PUBLIC_IPV4_RANGES = new BlockList();

(
  [
    ["0.0.0.0", 8],
    ["10.0.0.0", 8],
    ["100.64.0.0", 10],
    ["127.0.0.0", 8],
    ["169.254.0.0", 16],
    ["172.16.0.0", 12],
    ["192.0.0.0", 24],
    ["192.0.2.0", 24],
    ["192.168.0.0", 16],
    ["198.18.0.0", 15],
    ["198.51.100.0", 24],
    ["203.0.113.0", 24],
    ["224.0.0.0", 3]
  ] as const
).forEach(([network, prefix]) => NON_PUBLIC_IPV4_RANGES.addSubnet(network, prefix, "ipv4"));

export function isPublicIpv4(address: string): boolean {
  return isIPv4(address) && !NON_PUBLIC_IPV4_RANGES.check(address, "ipv4");
}
