import type { CertificateInfo } from "@akashnetwork/chain-sdk/web";
import { atom } from "jotai";

import type { ChainCertificate, LocalCert } from "@src/hooks/useCertificate/useCertificate";

const selectedCertificate = atom<ChainCertificate | null>(null);
const localCert = atom<LocalCert | null>(null);
const localCerts = atom<LocalCert[] | null>(null);
const parsedLocalCert = atom<CertificateInfo | null>(null);
const isLocalCertMatching = atom(false);

const effectiveLocalCert = atom<LocalCert | null>(get => {
  const parsed = get(parsedLocalCert);
  if (!parsed || parsed.expiresOn.getTime() <= Date.now()) return null;
  return get(localCert);
});

const isLocalCertExpired = atom<boolean>(get => {
  const parsed = get(parsedLocalCert);
  return !!parsed && parsed.expiresOn.getTime() <= Date.now();
});

export const certificateStore = {
  isLocalCertMatching,
  selectedCertificate,
  localCert,
  localCerts,
  parsedLocalCert,
  effectiveLocalCert,
  isLocalCertExpired
};
