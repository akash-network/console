import { getSelectedStorageWallet } from "./walletUtils";

export function getDeploymentLocalData(dseq) {
  const selectedNetworkId = localStorage.getItem("selectedNetworkId");
  const selectedWallet = getSelectedStorageWallet();
  const dataStr = localStorage.getItem(`${selectedNetworkId}/${selectedWallet.address}/deployments/${dseq}.data`);
  if (!dataStr) return null;

  const parsedData = JSON.parse(dataStr);

  return parsedData;
}

export function saveDeploymentManifestAndName(dseq, manifest, version, address, name) {
  saveDeploymentManifest(dseq, manifest, version, address);
  updateDeploymentLocalData(dseq, { name: name });
}

export function saveDeploymentManifest(dseq, manifest, version, address) {
  const data = getDeploymentLocalData(dseq) || {};
  data.owner = address;
  data.manifest = manifest;
  data.manifestVersion = version;

  updateDeploymentLocalData(dseq, { owner: address, manifest: manifest, manifestVersion: version });

  const selectedNetworkId = localStorage.getItem("selectedNetworkId");
  const selectedWallet = getSelectedStorageWallet();
  localStorage.setItem(`${selectedNetworkId}/${selectedWallet.address}/deployments/${dseq}.data`, JSON.stringify(data));
}

export function updateDeploymentLocalData(dseq, data) {
  const oldData = getDeploymentLocalData(dseq) || {};
  const newData = { ...oldData, ...data };

  const selectedNetworkId = localStorage.getItem("selectedNetworkId");
  const selectedWallet = getSelectedStorageWallet();
  localStorage.setItem(`${selectedNetworkId}/${selectedWallet.address}/deployments/${dseq}.data`, JSON.stringify(newData));
}
