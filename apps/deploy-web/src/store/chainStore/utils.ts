import type { ChainWalletBase, ChainWalletContext } from "@cosmos-kit/core";
import { WalletStatus } from "@cosmos-kit/core";

/**
 * Builds a ChainWalletContext from a ChainWalletBase instance.
 * Ported from @cosmos-kit/react-lite/esm/utils.js
 */
export function getChainWalletContext(chainId: string, wallet: ChainWalletBase | undefined, sync = true): ChainWalletContext {
  const walletAssert = (func: ((...args: any[]) => any) | undefined, params: any[] = [], name: string) => {
    if (!wallet) {
      throw new Error("Wallet is undefined. Please choose a wallet to connect first.");
    }
    if (!func) {
      throw new Error(`Function ${name} not implemented by ${wallet?.walletInfo.prettyName} yet.`);
    }
    return func(...params);
  };

  function clientMethodAssert(func: ((...args: any[]) => any) | undefined, params: any[] = [], name: string) {
    if (!wallet) {
      throw new Error("Wallet is undefined. Please choose a wallet to connect first.");
    }
    if (!wallet?.client) {
      throw new Error("Wallet Client is undefined.");
    }
    if (!func) {
      throw new Error(`Function ${name} not implemented by ${wallet?.walletInfo.prettyName} Client yet.`);
    }
    return func(...params);
  }

  const status = wallet?.walletStatus || WalletStatus.Disconnected;

  return {
    chainWallet: wallet,
    chain: wallet?.chainRecord.chain,
    assets: wallet?.chainRecord.assetList,
    logoUrl: wallet?.chainLogoUrl,
    wallet: wallet?.walletInfo,
    address: wallet?.address,
    username: wallet?.username,
    message: wallet ? wallet.message : "No wallet is connected walletly.",
    status,
    isWalletDisconnected: status === "Disconnected",
    isWalletConnecting: status === "Connecting",
    isWalletConnected: status === "Connected",
    isWalletRejected: status === "Rejected",
    isWalletNotExist: status === "NotExist",
    isWalletError: status === "Error",
    connect: () => walletAssert(wallet?.connect, [void 0, sync], "connect"),
    disconnect: (options?: any) => walletAssert(wallet?.disconnect, [void 0, sync, options], "disconnect"),
    getRpcEndpoint: (isLazy?: boolean) => walletAssert(wallet?.getRpcEndpoint, [isLazy], "getRpcEndpoint"),
    getRestEndpoint: (isLazy?: boolean) => walletAssert(wallet?.getRestEndpoint, [isLazy], "getRestEndpoint"),
    getStargateClient: () => walletAssert(wallet?.getStargateClient, [], "getStargateClient"),
    getCosmWasmClient: () => walletAssert(wallet?.getCosmWasmClient, [], "getCosmWasmClient"),
    getSigningStargateClient: () => walletAssert(wallet?.getSigningStargateClient, [], "getSigningStargateClient"),
    getSigningCosmWasmClient: () => walletAssert(wallet?.getSigningCosmWasmClient, [], "getSigningCosmWasmClient"),
    getNameService: () => walletAssert(wallet?.getNameService, [], "getNameService"),
    estimateFee: (...params: any[]) => walletAssert(wallet?.estimateFee, params, "estimateFee"),
    sign: (...params: any[]) => walletAssert(wallet?.sign, params, "sign"),
    broadcast: (...params: any[]) => walletAssert(wallet?.broadcast, params, "broadcast"),
    signAndBroadcast: (...params: any[]) => walletAssert(wallet?.signAndBroadcast, params, "signAndBroadcast"),
    qrUrl: wallet?.client?.qrUrl,
    appUrl: wallet?.client?.appUrl,
    defaultSignOptions: wallet?.client?.defaultSignOptions,
    setDefaultSignOptions: (...params: any[]) =>
      clientMethodAssert(wallet?.client?.setDefaultSignOptions?.bind(wallet.client), [...params], "setDefaultSignOptions"),
    enable: () => clientMethodAssert(wallet?.client?.enable?.bind(wallet.client), [chainId], "enable"),
    suggestToken: (...params: any[]) => clientMethodAssert(wallet?.client?.suggestToken?.bind(wallet.client), [...params], "suggestToken"),
    getAccount: () => clientMethodAssert(wallet?.client?.getAccount?.bind(wallet.client), [chainId], "getAccount"),
    getOfflineSigner: () => clientMethodAssert(wallet?.client?.getOfflineSigner?.bind(wallet.client), [chainId, wallet?.preferredSignType], "getOfflineSigner"),
    getOfflineSignerAmino: () => clientMethodAssert(wallet?.client?.getOfflineSignerAmino?.bind(wallet.client), [chainId], "getOfflineSignerAmino"),
    getOfflineSignerDirect: () => clientMethodAssert(wallet?.client?.getOfflineSignerDirect?.bind(wallet.client), [chainId], "getOfflineSignerDirect"),
    signAmino: (...params: any[]) => clientMethodAssert(wallet?.client?.signAmino?.bind(wallet.client), [chainId, ...params], "signAmino"),
    signDirect: (...params: any[]) => clientMethodAssert(wallet?.client?.signDirect?.bind(wallet.client), [chainId, ...params], "signDirect"),
    signArbitrary: (...params: any[]) => clientMethodAssert(wallet?.client?.signArbitrary?.bind(wallet.client), [chainId, ...params], "signArbitrary"),
    sendTx: (...params: any[]) => clientMethodAssert(wallet?.client?.sendTx?.bind(wallet.client), [chainId, ...params], "sendTx")
  } as ChainWalletContext;
}
