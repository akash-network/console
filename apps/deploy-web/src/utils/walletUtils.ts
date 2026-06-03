import type { NetworkId } from "@akashnetwork/chain-sdk/web";
import { LoggerService } from "@akashnetwork/logging";
import { isEqual } from "lodash";

import { browserEnvConfig } from "@src/config/browser-env.config";
import { ErrorHandlerService } from "@src/services/error-handler/error-handler.service";

const logger = new LoggerService({ name: "walletUtils" });
const errorHandler = new ErrorHandlerService(logger);

export interface ManagedLocalWallet {
  address: string;
  token?: string;
  selected: boolean;
  name: "Managed Wallet";
  isManaged: true;
  userId: string;
  creditAmount: number;
  isTrialing: boolean;
}

function getManagedWalletsStorageKey(networkId: NetworkId): string {
  return `${networkId}/managed-wallets`;
}

export function getStorageManagedWallet(userId?: string, networkId?: NetworkId): ManagedLocalWallet | undefined {
  if (!userId || typeof window === "undefined") {
    return undefined;
  }

  const selectedNetworkId: NetworkId = networkId || browserEnvConfig.NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID;
  const key = getManagedWalletsStorageKey(selectedNetworkId);
  const walletsMapStr = localStorage.getItem(key);

  if (!walletsMapStr) {
    return undefined;
  }

  try {
    const walletsMap = JSON.parse(walletsMapStr) as Record<string, ManagedLocalWallet>;
    return walletsMap[userId];
  } catch (error) {
    errorHandler.reportError({
      error,
      severity: "warning",
      tags: { context: "walletUtils.getStorageManagedWallet" },
      walletsMapStr,
      userId
    });
    return undefined;
  }
}

type ManagedWalletUpdate = { userId: string } & Partial<Omit<ManagedLocalWallet, "userId" | "name" | "isManaged">>;

export function updateStorageManagedWallet(update: ManagedWalletUpdate): ManagedLocalWallet | undefined {
  const networkId = browserEnvConfig.NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID;
  const prev = getStorageManagedWallet(update.userId, networkId);

  if (!prev && (update.address === undefined || update.creditAmount === undefined || update.isTrialing === undefined)) {
    errorHandler.reportError({
      error: new Error("Cannot create managed wallet entry without address, creditAmount and isTrialing"),
      severity: "warning",
      tags: { context: "walletUtils.updateStorageManagedWallet" },
      userId: update.userId
    });
    return undefined;
  }

  const next: ManagedLocalWallet = {
    address: update.address ?? prev!.address,
    token: update.token ?? prev?.token,
    creditAmount: update.creditAmount ?? prev!.creditAmount,
    isTrialing: update.isTrialing ?? prev!.isTrialing,
    userId: update.userId,
    name: "Managed Wallet",
    isManaged: true,
    selected: typeof update.selected === "boolean" ? update.selected : prev?.selected ?? false
  };

  if (isEqual(prev, next)) {
    return next;
  }

  const key = getManagedWalletsStorageKey(networkId);
  const walletsMapStr = localStorage.getItem(key);
  let walletsMap: Record<string, ManagedLocalWallet> = {};

  if (walletsMapStr) {
    try {
      walletsMap = JSON.parse(walletsMapStr);
    } catch (error) {
      errorHandler.reportError({
        error,
        severity: "warning",
        tags: { context: "walletUtils.updateStorageManagedWallet" },
        walletsMapStr
      });
    }
  }

  walletsMap[update.userId] = next;
  localStorage.setItem(key, JSON.stringify(walletsMap));

  return next;
}

export function deleteManagedWalletFromStorage(userId: string, networkId?: NetworkId) {
  if (!userId) {
    return;
  }

  const selectedNetworkId: NetworkId = networkId || browserEnvConfig.NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID;
  const key = getManagedWalletsStorageKey(selectedNetworkId);
  const walletsMapStr = localStorage.getItem(key);

  if (!walletsMapStr) {
    return;
  }

  try {
    const walletsMap: Record<string, ManagedLocalWallet> = JSON.parse(walletsMapStr);
    const wallet = walletsMap[userId];

    if (!wallet) {
      return;
    }

    delete walletsMap[userId];

    if (Object.keys(walletsMap).length > 0) {
      localStorage.setItem(key, JSON.stringify(walletsMap));
    } else {
      localStorage.removeItem(key);
    }

    localStorage.removeItem(`${selectedNetworkId}/${wallet.address}/settings`);
    localStorage.removeItem(`${selectedNetworkId}/${wallet.address}/provider.data`);

    const deploymentKeys = Object.keys(localStorage).filter(k => k.startsWith(`${selectedNetworkId}/${wallet.address}/deployments/`));
    for (const deploymentKey of deploymentKeys) {
      localStorage.removeItem(deploymentKey);
    }
  } catch (error) {
    errorHandler.reportError({
      error,
      severity: "warning",
      tags: { context: "walletUtils.deleteManagedWalletFromStorage" },
      walletsMapStr,
      userId
    });
    localStorage.removeItem(key);
  }
}

export function ensureUserManagedWalletOwnership(userId: string) {
  const networkId = browserEnvConfig.NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID;
  const wallet = getStorageManagedWallet(userId, networkId);

  if (wallet && !wallet.selected) {
    updateStorageManagedWallet({ userId, selected: true });
  }
}
