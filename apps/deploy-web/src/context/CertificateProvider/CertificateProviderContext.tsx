"use client";
import React, { useCallback, useEffect, useState } from "react";
import { certificateManager } from "@akashnetwork/akashjs/build/certificates/certificate-manager";
import { Snackbar } from "@akashnetwork/ui/components";
import axios from "axios";
import { event } from "nextjs-google-analytics";
import { useSnackbar } from "notistack";

import networkStore from "@src/store/networkStore";
import { RestApiCertificatesResponseType } from "@src/types/certificate";
import { AnalyticsEvents } from "@src/utils/analytics";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";
import { getStorageWallets, updateWallet } from "@src/utils/walletUtils";
import { useSettings } from "../SettingsProvider";
import { useWallet } from "../WalletProvider";

export type LocalCert = {
  certPem: string;
  keyPem: string;
  address: string;
};

type ChainCertificate = {
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
  loadValidCertificates: (showSnackbar?: boolean) => Promise<any>;
  selectedCertificate: ChainCertificate | null;
  setSelectedCertificate: React.Dispatch<ChainCertificate>;
  isLoadingCertificates: boolean;
  loadLocalCert: () => Promise<void>;
  localCert: LocalCert | null;
  setLocalCert: React.Dispatch<LocalCert>;
  isLocalCertMatching: boolean;
  validCertificates: Array<ChainCertificate>;
  setValidCertificates: React.Dispatch<React.SetStateAction<ChainCertificate[]>>;
  localCerts: Array<LocalCert> | null;
  setLocalCerts: React.Dispatch<React.SetStateAction<LocalCert[]>>;
  createCertificate: () => Promise<void>;
  isCreatingCert: boolean;
  regenerateCertificate: () => Promise<void>;
  revokeCertificate: (certificate: ChainCertificate) => Promise<void>;
  revokeAllCertificates: () => Promise<void>;
};

const CertificateProviderContext = React.createContext<ContextType>({} as ContextType);

export const CertificateProvider = ({ children }) => {
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
  const selectedNetwork = networkStore.useSelectedNetwork();

  const loadValidCertificates = useCallback(
    async (showSnackbar?: boolean) => {
      setIsLoadingCertificates(true);

      try {
        const response = await axios.get<RestApiCertificatesResponseType>(
          `${apiEndpoint}/akash/cert/${selectedNetwork.apiVersion}/certificates/list?filter.state=valid&filter.owner=${address}`
        );
        const certs = (response.data.certificates || []).map(cert => {
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
        const currentCert = validCerts.find(({ parsed }) => parsed === crtpem);
        setSelectedCertificate(currentCert as ChainCertificate);

        event(AnalyticsEvents.CREATE_CERTIFICATE, {
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

        event(AnalyticsEvents.REGENERATE_CERTIFICATE, {
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

      event(AnalyticsEvents.REVOKE_CERTIFICATE, {
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

      event(AnalyticsEvents.REVOKE_ALL_CERTIFICATE, {
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
