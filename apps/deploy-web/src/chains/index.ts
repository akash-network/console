import type { Chain } from "@chain-registry/types";

import { akash, akashAssetList } from "./akash";
import { akashSandbox, akashSandboxAssetList } from "./akash-sandbox";
import { akashTestnet, akashTestnetAssetList } from "./akash-testnet";

export { akash, akashSandbox, akashTestnet, akashAssetList, akashSandboxAssetList, akashTestnetAssetList };
export const chains: Chain[] = [akash, akashSandbox, akashTestnet].filter((c): c is Chain => c !== null);
export const assetLists = [akashAssetList, akashSandboxAssetList, ...(akashTestnet ? [akashTestnetAssetList] : [])];
