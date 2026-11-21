import { parseImageReference } from "./image-reference";

export type BlockedImageKind = "miner" | "proxyware";

/** Names are matched against whole words of an image's repository path, so `xmrig` blocks `acme/xmrig-cuda` and leaves `acme/xmrigger` alone. */
export const BLOCKED_IMAGE_NAMES: Readonly<Record<BlockedImageKind, readonly string[]>> = {
  miner: [
    "xmrig",
    "xmr-stak",
    "cpuminer",
    "ccminer",
    "cgminer",
    "bfgminer",
    "sgminer",
    "ethminer",
    "nbminer",
    "gminer",
    "lolminer",
    "bzminer",
    "srbminer",
    "t-rex-miner",
    "trex-miner",
    "phoenixminer",
    "teamredminer",
    "nanominer",
    "kawpowminer",
    "wildrig",
    "minerd",
    "nicehash",
    "minergate",
    "cryptonight",
    "randomx"
  ],
  proxyware: ["honeygain", "peer2profit", "packetstream", "earnapp", "traffmonetizer", "repocket", "pawns-cli", "proxyrack", "bitping"]
};

const WORD_SEPARATORS = /[^a-z0-9]+/;

const BLOCKED_KIND_BY_WORDS: ReadonlyMap<string, BlockedImageKind> = new Map(
  Object.entries(BLOCKED_IMAGE_NAMES).flatMap(([kind, names]) => names.map(name => [toWordKey(name.split(WORD_SEPARATORS)), kind as BlockedImageKind]))
);

const MAX_BLOCKED_NAME_WORDS = Math.max(...[...BLOCKED_KIND_BY_WORDS.keys()].map(key => key.split(" ").length));

export function findBlockedImageKind(image: string): BlockedImageKind | undefined {
  const words = parseImageReference(image).repository.split(WORD_SEPARATORS).filter(Boolean);

  for (let start = 0; start < words.length; start++) {
    for (let length = 1; length <= MAX_BLOCKED_NAME_WORDS; length++) {
      const kind = BLOCKED_KIND_BY_WORDS.get(toWordKey(words.slice(start, start + length)));
      if (kind) return kind;
    }
  }

  return undefined;
}

function toWordKey(words: string[]): string {
  return words.join(" ");
}
