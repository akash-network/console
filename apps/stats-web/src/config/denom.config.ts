import type { MainnetNetworkId, SandboxNetworkId } from "@akashnetwork/akashjs/build/types/network";
import { MAINNET_ID, SANDBOX_ID } from "@akashnetwork/network-store";

export const UAKT_DENOM = "uakt";
export const USDC_IBC_DENOMS: Record<MainnetNetworkId | SandboxNetworkId, string> = {
  [MAINNET_ID]: "ibc/170C677610AC31DF0904FFE09CD3B5C657492170E7E52372E48756B71E56F2F1",
  [SANDBOX_ID]: "ibc/12C6A0C374171B595A0A9E18B83FA09D295FB1F2D8C6DAA3AC28683471752D84"
};
