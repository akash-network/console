import type { MainWalletBase } from "@cosmos-kit/core";

const registry: Record<string, () => Promise<{ wallets: MainWalletBase[] }>> = {
  "keplr-extension": () => import("@cosmos-kit/keplr"),
  "leap-extension": () => import("@cosmos-kit/leap"),
  "cosmostation-extension": () => import("@cosmos-kit/cosmostation-extension"),
  "cosmos-extension-metamask": () => import("@cosmos-kit/cosmos-extension-metamask"),
  "keplr-mobile": () => import("@cosmos-kit/keplr"),
  "leap-mobile": () => import("@cosmos-kit/leap")
};

export async function loadWalletByName(name: string): Promise<MainWalletBase[]> {
  const loader = registry[name];
  if (!loader) {
    throw new Error(`Unknown wallet: ${name}`);
  }
  const { wallets } = await loader();
  return wallets;
}

export async function loadAllWallets(): Promise<MainWalletBase[]> {
  const wallets = await Promise.all(Object.keys(registry).map(name => loadWalletByName(name)));
  return wallets.flat();
}
