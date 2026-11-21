import { describe, expect, it } from "vitest";

import { BLOCKED_IMAGE_NAMES, findBlockedImageKind } from "./blocked-images";

describe(findBlockedImageKind.name, () => {
  it.each([
    { image: "xmrig/xmrig:6.21.0", kind: "miner" },
    { image: "ghcr.io/acme/XMRig-cuda:latest", kind: "miner" },
    { image: "acme/my_xmrig.build", kind: "miner" },
    { image: "docker.io/metal3d/xmrig", kind: "miner" },
    { image: "acme/xmr-stak:2", kind: "miner" },
    { image: "acme/gpu-t-rex-miner-cuda:0.26", kind: "miner" },
    { image: "acme/tools/trex_miner", kind: "miner" },
    { image: "acme/randomx@sha256:0123", kind: "miner" },
    { image: "honeygain/honeygain:1.0", kind: "proxyware" },
    { image: "iproyal/pawns-cli:1.2", kind: "proxyware" },
    { image: "traffmonetizer/cli_v2:arm64", kind: "proxyware" }
  ])("blocks $image as a $kind", ({ image, kind }) => {
    expect(findBlockedImageKind(image)).toBe(kind);
  });

  it.each([
    "nginx:1.27",
    "acme/xmrigger:1",
    "acme/bittensor-miner:2",
    "acme/t-rex:1",
    "acme/rex-miner:1",
    "ghcr.io/open-webui/open-webui:0.4.8",
    "xmrig.example.com/acme/web:1",
    "acme/web:xmrig"
  ])("allows %s", image => {
    expect(findBlockedImageKind(image)).toBeUndefined();
  });

  it("blocks every name on the list under its own kind", () => {
    const found = Object.entries(BLOCKED_IMAGE_NAMES).flatMap(([kind, names]) => names.map(name => [kind, findBlockedImageKind(`acme/${name}:1`)]));

    expect(found.filter(([kind, blocked]) => kind !== blocked)).toEqual([]);
  });
});
