"use client";
import React, { useCallback, useEffect, useState } from "react";
import { certificateManager } from "@akashnetwork/akashjs/build/certificates/certificate-manager";
import { Snackbar } from "@akashnetwork/ui/components";
import { useSnackbar } from "notistack";

import { analyticsService } from "@src/services/analytics/analytics.service";
import { RestApiCertificate } from "@src/types/certificate";
import { ApiUrlService, loadWithPagination } from "@src/utils/apiUtils";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";
import { getStorageWallets, updateWallet } from "@src/utils/walletUtils";
import { useSettings } from "../SettingsProvider";
import { useWallet } from "../WalletProvider";

export type LocalCert = {
  certPem: string;
  keyPem: string;
  address: string;
};

export type ChainCertificate = {
  serial: string;
  parsed: string;
  pem: {
    hSerial: string;
    sIssuer: string;
    sSubject: string;
    sNotBefore: string;
    sNotAfter: string;
    issuedOn: Date;
    expiresOn: Date;
  };
  certificate: {
    cert: string;
    pubkey: string;
    state: string;
  };
};

type ContextType = {
  loadValidCertificates: (showSnackbar?: boolean) => Promise<ChainCertificate[]>;
  selectedCertificate: ChainCertificate | null;
  setSelectedCertificate: React.Dispatch<ChainCertificate | null>;
  isLoadingCertificates: boolean;
  loadLocalCert: () => Promise<void>;
  localCert: LocalCert | null;
  setLocalCert: React.Dispatch<LocalCert>;
  isLocalCertMatching: boolean;
  validCertificates: Array<ChainCertificate>;
  setValidCertificates: React.Dispatch<React.SetStateAction<ChainCertificate[]>>;
  localCerts: Array<LocalCert> | null;
  setLocalCerts: React.Dispatch<React.SetStateAction<LocalCert[] | null>>;
  createCertificate: () => Promise<void>;
  isCreatingCert: boolean;
  regenerateCertificate: () => Promise<void>;
  revokeCertificate: (certificate: ChainCertificate) => Promise<void>;
  revokeAllCertificates: () => Promise<void>;
};

const CertificateProviderContext = React.createContext<ContextType>({} as ContextType);

export const CertificateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isCreatingCert, setIsCreatingCert] = useState(false);
  const [validCertificates, setValidCertificates] = useState<Array<ChainCertificate>>([]);
  const [selectedCertificate, setSelectedCertificate] = useState<ChainCertificate | null>(null);
  const [isLoadingCertificates, setIsLoadingCertificates] = useState(false);
  const [localCerts, setLocalCerts] = useState<Array<LocalCert> | null>(null);
  const [localCert, setLocalCert] = useState<LocalCert | null>(null);
  const [isLocalCertMatching, setIsLocalCertMatching] = useState(false);
  const { settings, isSettingsInit } = useSettings();
  const { enqueueSnackbar } = useSnackbar();
  const { address, signAndBroadcastTx } = useWallet();
  const { apiEndpoint } = settings;

  const loadValidCertificates = useCallback(
    async (showSnackbar?: boolean): Promise<ChainCertificate[]> => {
      setIsLoadingCertificates(true);

      try {
        const certificates = await loadWithPagination<RestApiCertificate[]>(ApiUrlService.certificatesList(apiEndpoint, address), "certificates", 1000);
        const certs = (certificates || []).map(cert => {
          const parsed = atob(cert.certificate.cert);
          const pem = certificateManager.parsePem(parsed);

          return {
            ...cert,
            parsed,
            pem
          };
        });

        setValidCertificates(certs);
        setIsLoadingCertificates(false);

        if (showSnackbar) {
          enqueueSnackbar(<Snackbar title="Certificate refreshed!" iconVariant="success" />, { variant: "success" });
        }

        return certs;
      } catch (error) {
        console.log(error);

        setIsLoadingCertificates(false);
        if (showSnackbar) {
          enqueueSnackbar(<Snackbar title="Error fetching certificate." iconVariant="error" />, { variant: "error" });
        }

        return [];
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [address, apiEndpoint, localCert, selectedCertificate]
  );

  /**
   * When changing wallet, reset certs and load for new wallet
   */
  useEffect(() => {
    if (!isSettingsInit) return;

    setValidCertificates([]);
    setSelectedCertificate(null);
    setLocalCert(null);

    if (address) {
      loadValidCertificates();
      loadLocalCert();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, isSettingsInit]);

  useEffect(() => {
    let isMatching = false;
    if (validCertificates?.length > 0 && localCert) {
      let currentCert = validCertificates.find(x => x.parsed === localCert.certPem);

      if (!selectedCertificate && currentCert) {
        setSelectedCertificate(currentCert);
      } else {
        currentCert = validCertificates.find(x => x.parsed === localCert?.certPem && selectedCertificate?.serial === x.serial);
      }

      isMatching = !!currentCert;
    }

    setIsLocalCertMatching(isMatching);
  }, [selectedCertificate, localCert, validCertificates]);

  const loadLocalCert = async () => {
    const wallets = getStorageWallets();
    const certs = wallets.reduce((acc, wallet) => {
      const cert: LocalCert | null = wallet.cert && wallet.certKey ? { certPem: wallet.cert, keyPem: wallet.certKey, address: wallet.address } : null;

      if (cert) {
        acc.push(cert);
      }

      if (wallet.address === address) {
        setLocalCert(cert);
      }

      return acc;
    }, [] as LocalCert[]);

    setLocalCerts(certs);
  };

  /**
   * Create certificate
   */
  async function createCertificate() {
    setIsCreatingCert(true);

    const { cert: crtpem, publicKey: pubpem, privateKey: encryptedKey } = certificateManager.generatePEM(address);

    try {
      const message = TransactionMessageData.getCreateCertificateMsg(address, crtpem, pubpem);
      const response = await signAndBroadcastTx([message]);
      if (response) {
        updateWallet(address, wallet => {
          return {
            ...wallet,
            cert: crtpem,
            certKey: encryptedKey
          };
        });
        const validCerts = await loadValidCertificates();
        loadLocalCert();
        const currentCert = validCerts.find(({ parsed }) => parsed === crtpem) || null;
        setSelectedCertificate(currentCert);

        analyticsService.track("create_certificate", {
          category: "certificates",
          label: "Created certificate"
        });
      }

      setIsCreatingCert(false);
    } catch (error) {
      setIsCreatingCert(false);

      throw error;
    }
  }

  /**
   * Regenerate certificate
   */
  async function regenerateCertificate() {
    setIsCreatingCert(true);
    const { cert: crtpem, publicKey: pubpem, privateKey: encryptedKey } = certificateManager.generatePEM(address);

    try {
      const revokeCertMsg = TransactionMessageData.getRevokeCertificateMsg(address, selectedCertificate?.serial as string);
      const createCertMsg = TransactionMessageData.getCreateCertificateMsg(address, crtpem, pubpem);
      const response = await signAndBroadcastTx([revokeCertMsg, createCertMsg]);
      if (response) {
        updateWallet(address, wallet => {
          return {
            ...wallet,
            cert: crtpem,
            certKey: encryptedKey
          };
        });
        const validCerts = await loadValidCertificates();
        loadLocalCert();
        const currentCert = validCerts.find(x => x.parsed === crtpem);
        setSelectedCertificate(currentCert as ChainCertificate);

        analyticsService.track("regenerate_certificate", {
          category: "certificates",
          label: "Regenerated certificate"
        });
      }

      setIsCreatingCert(false);
    } catch (error) {
      setIsCreatingCert(false);
      throw error;
    }
  }

  /**
   * Revoke certificate
   */
  const revokeCertificate = async (certificate: ChainCertificate) => {
    const message = TransactionMessageData.getRevokeCertificateMsg(address, certificate.serial);
    const response = await signAndBroadcastTx([message]);
    if (response) {
      const validCerts = await loadValidCertificates();
      const isRevokingOtherCert = validCerts.some(c => c.parsed === localCert?.certPem);
      updateWallet(address, wallet => {
        return {
          ...wallet,
          cert: isRevokingOtherCert ? wallet.cert : undefined,
          certKey: isRevokingOtherCert ? wallet.certKey : undefined
        };
      });
      if (validCerts?.length > 0 && certificate.serial === selectedCertificate?.serial) {
        setSelectedCertificate(validCerts[0]);
      } else if (validCerts?.length === 0) {
        setSelectedCertificate(null);
      }

      analyticsService.track("revoke_certificate", {
        category: "certificates",
        label: "Revoked certificate"
      });
    }
  };

  /**
   * Revoke all certificates
   */
  const revokeAllCertificates = async () => {
    const messages = validCertificates.map(cert => TransactionMessageData.getRevokeCertificateMsg(address, cert.serial));
    const response = await signAndBroadcastTx(messages);
    if (response) {
      await loadValidCertificates();

      updateWallet(address, wallet => {
        return {
          ...wallet,
          cert: undefined,
          certKey: undefined
        };
      });

      setSelectedCertificate(null);

      analyticsService.track("revoke_all_certificates", {
        category: "certificates",
        label: "Revoked all certificates"
      });
    }
  };

  return (
    <CertificateProviderContext.Provider
      value={{
        loadValidCertificates,
        selectedCertificate,
        setSelectedCertificate,
        isLoadingCertificates,
        loadLocalCert,
        localCert,
        setLocalCert,
        isLocalCertMatching,
        validCertificates,
        setValidCertificates,
        localCerts,
        setLocalCerts,
        createCertificate,
        isCreatingCert,
        regenerateCertificate,
        revokeCertificate,
        revokeAllCertificates
      }}
    >
      {children}
    </CertificateProviderContext.Provider>
  );
};

export const useCertificate = () => {
  return { ...React.useContext(CertificateProviderContext) };
};
