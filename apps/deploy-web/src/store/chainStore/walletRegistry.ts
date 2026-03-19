import type { MainWalletBase } from "@cosmos-kit/core";

type WalletLoader = () => Promise<MainWalletBase[]>;

const registry: Record<string, WalletLoader> = {
  "keplr-extension": async () => {
    const { wallets } = await import("@cosmos-kit/keplr");
    return wallets;
  },
  "leap-extension": async () => {
    const { wallets } = await import("@cosmos-kit/leap");
    return wallets;
  },
  "cosmostation-extension": async () => {
    const { wallets } = await import("@cosmos-kit/cosmostation-extension");
    return wallets;
  },
  "cosmos-extension-metamask": async () => {
    const { wallets } = await import("@cosmos-kit/cosmos-extension-metamask");
    return wallets;
  },
  "keplr-mobile": async () => {
    const { wallets } = await import("@cosmos-kit/keplr");
    return wallets;
  },
  "leap-mobile": async () => {
    const { wallets } = await import("@cosmos-kit/leap");
    return wallets;
  }
};

export async function loadWalletByName(name: string): Promise<MainWalletBase[]> {
  const loader = registry[name];
  if (!loader) {
    throw new Error(`Unknown wallet: ${name}`);
  }
  return loader();
}

export async function loadAllWallets(): Promise<MainWalletBase[]> {
  const [keplr, leap, cosmostation, metamask] = await Promise.all(Object.values(registry).map(loader => loader()));
  return [...keplr, ...leap, ...cosmostation, ...metamask];
}
