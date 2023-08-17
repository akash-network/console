import { getSelectedStorageWallet } from "./walletUtils";

export type LocalDeploymentData = {
  owner?: string;
  name?: string;
  manifest?: string;
  manifestVersion?: string;
};

export function getDeploymentLocalData(dseq: string | number) {
  const selectedNetworkId = localStorage.getItem("selectedNetworkId");
  const selectedWallet = getSelectedStorageWallet();
  const dataStr = localStorage.getItem(`${selectedNetworkId}/${selectedWallet.address}/deployments/${dseq}.data`);
  if (!dataStr) return null;

  const parsedData = JSON.parse(dataStr) as LocalDeploymentData;

  return parsedData;
}

export function saveDeploymentManifestAndName(dseq: string, manifest: string, version: string, address: string, name: string) {
  saveDeploymentManifest(dseq, manifest, version, address);
  updateDeploymentLocalData(dseq, { name: name });
}

export function saveDeploymentManifest(dseq: string, manifest: string, version: string, address: string) {
  const data = getDeploymentLocalData(dseq) || {};
  data.owner = address;
  data.manifest = manifest;
  data.manifestVersion = version;

  updateDeploymentLocalData(dseq, { owner: address, manifest: manifest, manifestVersion: version });

  const selectedNetworkId = localStorage.getItem("selectedNetworkId");
  const selectedWallet = getSelectedStorageWallet();
  localStorage.setItem(`${selectedNetworkId}/${selectedWallet.address}/deployments/${dseq}.data`, JSON.stringify(data));
}

export function updateDeploymentLocalData(dseq: string, data: LocalDeploymentData) {
  const oldData = getDeploymentLocalData(dseq) || {};
  const newData = { ...oldData, ...data };

  const selectedNetworkId = localStorage.getItem("selectedNetworkId");
  const selectedWallet = getSelectedStorageWallet();
  localStorage.setItem(`${selectedNetworkId}/${selectedWallet.address}/deployments/${dseq}.data`, JSON.stringify(newData));
}
