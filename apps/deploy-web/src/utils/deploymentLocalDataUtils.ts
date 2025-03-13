import networkStore from "@src/store/networkStore";
import { getSelectedStorageWallet } from "./walletUtils";

export type LocalDeploymentData = {
  owner?: string;
  name?: string;
  manifest?: string;
  manifestVersion?: Uint8Array;
};

export function getDeploymentLocalData(dseq: string | number | null): LocalDeploymentData | null {
  if (!dseq) return null;
  const selectedWallet = getSelectedStorageWallet();

  if (!selectedWallet) return null;

  const dataStr = localStorage.getItem(`${networkStore.selectedNetworkId}/${selectedWallet.address}/deployments/${dseq}.data`);

  return dataStr ? JSON.parse(dataStr) : null;
}

export function saveDeploymentManifestAndName(dseq: string, manifest: string, version: Uint8Array, address: string, name: string) {
  saveDeploymentManifest(dseq, manifest, version, address);
  updateDeploymentLocalData(dseq, { name: name });
}

export function saveDeploymentManifest(dseq: string, manifest: string, version: Uint8Array, address: string) {
  const data = getDeploymentLocalData(dseq) || {};
  data.owner = address;
  data.manifest = manifest;
  data.manifestVersion = version;

  updateDeploymentLocalData(dseq, { owner: address, manifest: manifest, manifestVersion: version });

  const selectedWallet = getSelectedStorageWallet();
  localStorage.setItem(`${networkStore.selectedNetworkId}/${selectedWallet.address}/deployments/${dseq}.data`, JSON.stringify(data));
}

export function updateDeploymentLocalData(dseq: string, data: LocalDeploymentData) {
  const oldData = getDeploymentLocalData(dseq) || {};
  const newData = { ...oldData, ...data };

  const selectedWallet = getSelectedStorageWallet();
  localStorage.setItem(`${networkStore.selectedNetworkId}/${selectedWallet.address}/deployments/${dseq}.data`, JSON.stringify(newData));
}
