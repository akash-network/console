import type { NetworkStore } from "@akashnetwork/network-store";

import { fromBase64, toBase64 } from "@src/utils/encoding";

export class DeploymentStorageService {
  constructor(
    private readonly storage: Storage,
    private readonly networkStore: NetworkStore
  ) {}

  get(walletAddress: string | undefined | null, dseq: string | number | undefined | null): Partial<LocalDeploymentData> | null {
    if (!dseq || !walletAddress) return null;

    const key = genKey(this.networkStore.selectedNetworkId, walletAddress, dseq);
    const dataStr = this.storage.getItem(key);
    const data = dataStr ? JSON.parse(dataStr) : null;

    if (data?.manifestVersion) {
      data.manifestVersion =
        data.manifestVersion && typeof data.manifestVersion === "object" ? createUint8ArrayFromObject(data.manifestVersion) : fromBase64(data.manifestVersion);
    }

    return data;
  }

  set(walletAddress: string | undefined | null, dseq: string | number | undefined | null, data: Partial<Omit<LocalDeploymentData, "owner">>): void {
    if (!dseq || !walletAddress) return;

    const key = genKey(this.networkStore.selectedNetworkId, walletAddress, dseq);
    const dataToSave: Record<string, any> = { owner: walletAddress, ...data };
    if (dataToSave.manifestVersion) {
      dataToSave.manifestVersion = toBase64(dataToSave.manifestVersion);
    }
    this.storage.setItem(key, JSON.stringify(dataToSave));
  }

  update(walletAddress: string | undefined | null, dseq: string | number | undefined | null, data: Partial<LocalDeploymentData>): void {
    if (!dseq || !walletAddress) return;

    const currentData = this.get(walletAddress, dseq);
    const newData = { ...currentData, ...data };
    this.set(walletAddress, dseq, newData);
  }

  delete(walletAddress: string | undefined | null, dseq: string | undefined | null): void {
    if (!dseq || !walletAddress) return;

    const key = genKey(this.networkStore.selectedNetworkId, walletAddress, dseq);
    this.storage.removeItem(key);
  }
}

export interface LocalDeploymentData {
  owner: string;
  name: string;
  manifest: string;
  manifestVersion: Uint8Array;
}

function genKey(networkId: string, walletAddress: string, dseq: string | number): string {
  return `${networkId}/${walletAddress}/deployments/${dseq}.data`;
}

function createUint8ArrayFromObject(obj: Record<string, number>): Uint8Array {
  const keys = Object.keys(obj);
  const data = new Array<number>(keys.length);
  keys.forEach(key => {
    data[Number(key)] = obj[key];
  });
  return new Uint8Array(data);
}
