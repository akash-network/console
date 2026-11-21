import dns from "node:dns";
import { BlockList, isIP, type LookupFunction } from "node:net";

export const FORBIDDEN_ADDRESS_ERROR_CODE = "EFORBIDDEN";

/** Covers loopback, private, carrier-grade NAT, link-local (which holds the cloud metadata addresses), unique-local, site-local, multicast, reserved and documentation ranges, and the IPv6 forms that wrap an IPv4 address; `BlockList` reads an IPv4-mapped IPv6 address by its IPv4 rules. */
const NON_PUBLIC_ADDRESSES = new BlockList();
NON_PUBLIC_ADDRESSES.addSubnet("0.0.0.0", 8, "ipv4");
NON_PUBLIC_ADDRESSES.addSubnet("10.0.0.0", 8, "ipv4");
NON_PUBLIC_ADDRESSES.addSubnet("100.64.0.0", 10, "ipv4");
NON_PUBLIC_ADDRESSES.addSubnet("127.0.0.0", 8, "ipv4");
NON_PUBLIC_ADDRESSES.addSubnet("169.254.0.0", 16, "ipv4");
NON_PUBLIC_ADDRESSES.addSubnet("172.16.0.0", 12, "ipv4");
NON_PUBLIC_ADDRESSES.addSubnet("192.0.0.0", 24, "ipv4");
NON_PUBLIC_ADDRESSES.addSubnet("192.0.2.0", 24, "ipv4");
NON_PUBLIC_ADDRESSES.addSubnet("192.168.0.0", 16, "ipv4");
NON_PUBLIC_ADDRESSES.addSubnet("198.18.0.0", 15, "ipv4");
NON_PUBLIC_ADDRESSES.addSubnet("198.51.100.0", 24, "ipv4");
NON_PUBLIC_ADDRESSES.addSubnet("203.0.113.0", 24, "ipv4");
NON_PUBLIC_ADDRESSES.addSubnet("224.0.0.0", 4, "ipv4");
NON_PUBLIC_ADDRESSES.addSubnet("240.0.0.0", 4, "ipv4");
NON_PUBLIC_ADDRESSES.addAddress("::", "ipv6");
NON_PUBLIC_ADDRESSES.addAddress("::1", "ipv6");
NON_PUBLIC_ADDRESSES.addSubnet("64:ff9b::", 96, "ipv6");
NON_PUBLIC_ADDRESSES.addSubnet("64:ff9b:1::", 48, "ipv6");
NON_PUBLIC_ADDRESSES.addSubnet("2001::", 32, "ipv6");
NON_PUBLIC_ADDRESSES.addSubnet("2001:db8::", 32, "ipv6");
NON_PUBLIC_ADDRESSES.addSubnet("2002::", 16, "ipv6");
NON_PUBLIC_ADDRESSES.addSubnet("fc00::", 7, "ipv6");
NON_PUBLIC_ADDRESSES.addSubnet("fe80::", 10, "ipv6");
NON_PUBLIC_ADDRESSES.addSubnet("fec0::", 10, "ipv6");
NON_PUBLIC_ADDRESSES.addSubnet("ff00::", 8, "ipv6");

type BaseLookup = (
  hostname: string,
  options: dns.LookupAllOptions,
  callback: (error: NodeJS.ErrnoException | null, addresses: dns.LookupAddress[]) => void
) => void;

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);

  return family !== 0 && !NON_PUBLIC_ADDRESSES.check(address, family === 4 ? "ipv4" : "ipv6");
}

/** Given to the socket as its resolver, so the addresses it checks are the ones the connection is made to and a second DNS answer cannot swap them. */
export function createPublicNetworkLookup(baseLookup: BaseLookup = dns.lookup): LookupFunction {
  return (hostname, options, callback) => {
    baseLookup(hostname, { ...options, all: true }, (error, addresses) => {
      if (error) return callback(error, "");

      const forbidden = addresses.find(({ address }) => !isPublicAddress(address));

      if (forbidden || addresses.length === 0) return callback(createForbiddenAddressError(hostname, forbidden?.address), "");
      if (options.all) return callback(null, addresses);

      callback(null, addresses[0].address, addresses[0].family);
    });
  };
}

function createForbiddenAddressError(hostname: string, address: string | undefined): NodeJS.ErrnoException {
  const error: NodeJS.ErrnoException = new Error(`Hostname ${hostname} resolved to ${address ?? "no address"}, which is not a public address`);
  error.code = FORBIDDEN_ADDRESS_ERROR_CODE;

  return error;
}
