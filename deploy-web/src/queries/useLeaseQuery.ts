import { useQuery } from "react-query";
import { QueryKeys } from "./queryKeys";
import { useSettings } from "../context/SettingsProvider";
import { useCertificate } from "../context/CertificateProvider";
import { leaseToDto } from "@src/utils/deploymentDetailUtils";
import { ApiUrlService, loadWithPagination } from "@src/utils/apiUtils";
import axios from "axios";
import { PROVIDER_PROXY_URL } from "@src/utils/constants";
import { LeaseDto } from "@src/types/deployment";
import { LocalCert } from "@src/context/CertificateProvider/CertificateProviderContext";

// Leases
async function getDeploymentLeases(apiEndpoint: string, address: string, deployment) {
  if (!address) {
    return null;
  }

  const response = await loadWithPagination(ApiUrlService.leaseList(apiEndpoint, address, deployment?.dseq), "leases", 1000);

  const leases = response.map(l => leaseToDto(l, deployment));

  return leases;
}

export function useDeploymentLeaseList(address: string, deployment, options) {
  const { settings } = useSettings();

  return useQuery(QueryKeys.getLeasesKey(address, deployment?.dseq), () => getDeploymentLeases(settings.apiEndpoint, address, deployment), options);
}

async function getAllLeases(apiEndpoint: string, address: string, deployment?) {
  if (!address) {
    return null;
  }

  const response = await loadWithPagination(ApiUrlService.leaseList(apiEndpoint, address, deployment?.dseq), "leases", 1000);

  const leases = response.map(l => leaseToDto(l, deployment));

  return leases;
}

export function useAllLeases(address: string, options = {}) {
  const { settings } = useSettings();
  return useQuery(QueryKeys.getAllLeasesKey(address), () => getAllLeases(settings.apiEndpoint, address), options);
}

async function getLeaseStatus(providerUri: string, lease: LeaseDto, localCert: LocalCert) {
  if (!providerUri) return null;

  const leaseStatusPath = `${providerUri}/lease/${lease.dseq}/${lease.gseq}/${lease.oseq}/status`;
  const response = await axios.post(PROVIDER_PROXY_URL, {
    method: "GET",
    url: leaseStatusPath,
    certPem: localCert?.certPem,
    keyPem: localCert?.keyPem
  });

  return response.data;
}

export function useLeaseStatus(providerUri: string, lease: LeaseDto, options) {
  const { localCert } = useCertificate();
  return useQuery(QueryKeys.getLeaseStatusKey(lease?.dseq, lease?.gseq, lease?.oseq), () => getLeaseStatus(providerUri, lease, localCert), options);
}
