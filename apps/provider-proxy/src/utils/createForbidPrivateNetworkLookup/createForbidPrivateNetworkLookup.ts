import dns from "node:dns";
import { BlockList } from "node:net";

export const PRIVATE_NETWORK_BLOCK_LIST = new BlockList();
// IPv4
PRIVATE_NETWORK_BLOCK_LIST.addSubnet("0.0.0.0", 8, "ipv4");
PRIVATE_NETWORK_BLOCK_LIST.addSubnet("10.0.0.0", 8, "ipv4");
PRIVATE_NETWORK_BLOCK_LIST.addSubnet("100.64.0.0", 10, "ipv4");
PRIVATE_NETWORK_BLOCK_LIST.addSubnet("127.0.0.0", 8, "ipv4");
PRIVATE_NETWORK_BLOCK_LIST.addSubnet("169.254.0.0", 16, "ipv4");
PRIVATE_NETWORK_BLOCK_LIST.addSubnet("172.16.0.0", 12, "ipv4");
PRIVATE_NETWORK_BLOCK_LIST.addSubnet("192.168.0.0", 16, "ipv4");
PRIVATE_NETWORK_BLOCK_LIST.addAddress("255.255.255.255", "ipv4");
// IPv6
PRIVATE_NETWORK_BLOCK_LIST.addAddress("::", "ipv6");
PRIVATE_NETWORK_BLOCK_LIST.addAddress("::1", "ipv6");
PRIVATE_NETWORK_BLOCK_LIST.addSubnet("fc00::", 7, "ipv6");
PRIVATE_NETWORK_BLOCK_LIST.addSubnet("fe80::", 10, "ipv6");

export function createForbidPrivateNetworkLookup(baseLookup: BaseLookup = dns.lookup, blockList: BlockList = PRIVATE_NETWORK_BLOCK_LIST): NetworkLookup {
  return function forbidPrivateNetworkLookup(hostname: string, options: dns.LookupOptions, callback: LookupCallback) {
    baseLookup(hostname, { ...options, all: true }, (err, addresses) => {
      if (err) return callback(err, "");

      for (const { address, family } of addresses) {
        if (blockList.check(address, family === 4 ? "ipv4" : "ipv6")) {
          const blocked: NodeJS.ErrnoException = new Error(`Hostname ${hostname} resolved to forbidden address ${address}`);
          blocked.code = "EFORBIDDEN";
          return callback(blocked, "");
        }
      }

      if (options.all) {
        return callback(null, addresses);
      }
      const [first] = addresses;
      callback(null, first.address, first.family);
    });
  };
}

export type NetworkLookup = (hostname: string, options: dns.LookupOptions, callback: LookupCallback) => void;
type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void;
type BaseLookup = (
  hostname: string,
  options: dns.LookupAllOptions,
  callback: (err: NodeJS.ErrnoException | null, addresses: dns.LookupAddress[]) => void
) => void;
