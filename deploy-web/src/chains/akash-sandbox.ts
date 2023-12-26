import { akash, akashAssetList } from "./akash";

export const akashSandbox = {
  ...akash,
  chain_id: "sandbox-01",
  network_type: "sandbox",
  chain_name: "akash-sandbox",
  pretty_name: "Akash-Sandbox",
  apis: {
    rpc: [{ address: "https://rpc.sandbox-01.aksh.pw", provider: "ovrclk" }],
    rest: [{ address: "https://api.sandbox-01.aksh.pw", provider: "ovrclk" }]
  }
};

export const akashSandboxAssetList = { ...akashAssetList, chain_name: "akash-sandbox", assets: [...akashAssetList.assets] };
