import type {
  CPUInfo,
  GPUInfo,
  Inventory,
  Node as SdkNode,
  ResourcePair as SdkResourcePair,
  Storage as SdkStorage
} from "@akashnetwork/chain-sdk/private-types/provider.akash.v1";

import type { ClusterState, CpuInfo, GpuInfo, NodeState, RawPair } from "@src/types/inventory";

interface Quantity {
  string?: string | undefined;
}

const BINARY_POW2: Record<string, number> = { Ki: 10, Mi: 20, Gi: 30, Ti: 40, Pi: 50, Ei: 60 };
const DECIMAL_POW10: Record<string, number> = { n: -9, u: -6, m: -3, "": 0, k: 3, M: 6, G: 9, T: 12, P: 15, E: 18 };

export function parseQuantity(q: Quantity | undefined, multiplier: bigint = 1n): bigint {
  const raw = q?.string?.trim();
  if (!raw) return 0n;

  const binary = /^(-?\d+(?:\.\d+)?)([KMGTPE]i)$/.exec(raw);
  if (binary) return scaleByPow2(binary[1], BINARY_POW2[binary[2]], multiplier);

  const exponent = /^(-?\d+(?:\.\d+)?)[eE](-?\d+)$/.exec(raw);
  if (exponent) return scaleByPow10(exponent[1], Number(exponent[2]), multiplier);

  const decimal = /^(-?\d+(?:\.\d+)?)([numkMGTPE]?)$/.exec(raw);
  if (decimal) return scaleByPow10(decimal[1], DECIMAL_POW10[decimal[2]], multiplier);

  return 0n;
}

function scaleByPow2(mantissaStr: string, pow2: number, multiplier: bigint): bigint {
  const { negative, digits, fracLen } = parseMantissa(mantissaStr);
  const scaled = digits * 2n ** BigInt(pow2) * multiplier;
  const truncated = fracLen === 0 ? scaled : scaled / 10n ** BigInt(fracLen);
  return negative ? -truncated : truncated;
}

function scaleByPow10(mantissaStr: string, pow10: number, multiplier: bigint): bigint {
  const { negative, digits, fracLen } = parseMantissa(mantissaStr);
  const netExp = pow10 - fracLen;
  const scaled = netExp >= 0 ? digits * 10n ** BigInt(netExp) * multiplier : (digits * multiplier) / 10n ** BigInt(-netExp);
  return negative ? -scaled : scaled;
}

function parseMantissa(s: string): { negative: boolean; digits: bigint; fracLen: number } {
  let i = 0;
  let negative = false;
  if (s[0] === "-") {
    negative = true;
    i = 1;
  } else if (s[0] === "+") {
    i = 1;
  }
  const body = s.slice(i);
  const dot = body.indexOf(".");
  if (dot === -1) {
    return { negative, digits: BigInt(body || "0"), fracLen: 0 };
  }
  const intPart = body.slice(0, dot);
  const fracPart = body.slice(dot + 1);
  return { negative, digits: BigInt((intPart || "0") + fracPart || "0"), fracLen: fracPart.length };
}

function pairFromSdk(pair: SdkResourcePair | undefined, multiplier: bigint = 1n): RawPair {
  return {
    allocatable: parseQuantity(pair?.allocatable, multiplier),
    allocated: parseQuantity(pair?.allocated, multiplier)
  };
}

function mapGpuInfo(info: GPUInfo): GpuInfo {
  return {
    vendor: info.vendor,
    name: info.name,
    modelId: info.modelid,
    interface: info.interface,
    memorySize: info.memorySize
  };
}

function mapCpuInfo(info: CPUInfo): CpuInfo {
  return { vendor: info.vendor, model: info.model };
}

function mapNode(node: SdkNode): NodeState {
  const resources = node.resources;
  return {
    name: node.name,
    cpu: pairFromSdk(resources?.cpu?.quantity, 1000n),
    memory: pairFromSdk(resources?.memory?.quantity),
    ephemeralStorage: pairFromSdk(resources?.ephemeralStorage),
    gpu: {
      quantity: pairFromSdk(resources?.gpu?.quantity),
      info: (resources?.gpu?.info ?? []).map(mapGpuInfo)
    },
    storageClasses: node.capabilities?.storageClasses ?? [],
    cpus: (resources?.cpu?.info ?? []).map(mapCpuInfo)
  };
}

function mapClusterStorage(storage: SdkStorage[] | undefined): ClusterState["storage"] {
  if (!storage) return;

  const result: Exclude<ClusterState["storage"], undefined> = Object.create(null);
  for (const pool of storage) {
    const cls = pool.info?.class ?? "";
    result[cls] = { class: cls, quantity: pairFromSdk(pool.quantity) };
  }
  return result;
}

export function mapInventoryToClusterState(inventory: Inventory): ClusterState {
  return {
    nodes: inventory.cluster?.nodes.map(mapNode),
    storage: mapClusterStorage(inventory.cluster?.storage),
    leasedIp: pairFromSdk(inventory.leasedIp)
  };
}
