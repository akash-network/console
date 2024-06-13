"use client";
import { useState } from "react";
import { MdAutorenew, MdGetApp } from "react-icons/md";
import { BinMinusIn, Check, MoreHoriz, PlusCircle, Refresh, WarningTriangle } from "iconoir-react";

import { FormPaper } from "@src/components/sdl/FormPaper";
import { CustomDropdownLinkItem } from "@src/components/shared/CustomDropdownLinkItem";
import { CustomTooltip } from "@src/components/shared/CustomTooltip";
import Spinner from "@src/components/shared/Spinner";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@akashnetwork/ui/components";
import { useWallet } from "@src/context/WalletProvider";
import { useCertificate } from "../../context/CertificateProvider";
import { ExportCertificate } from "./ExportCertificate";

export function CertificateDisplay() {
  const [isExportingCert, setIsExportingCert] = useState(false);
  const {
    selectedCertificate,
    isLocalCertMatching,
    isLoadingCertificates,
    loadValidCertificates,
    localCert,
    createCertificate,
    isCreatingCert,
    regenerateCertificate,
    revokeCertificate
  } = useCertificate();
  const { address } = useWallet();

  const onRegenerateCert = () => {
    regenerateCertificate();
  };

  const onRevokeCert = () => {
    if (selectedCertificate) revokeCertificate(selectedCertificate);
  };

  return (
    <>
      {address && (
        <FormPaper className="mb-4" contentClassName="flex items-center">
          <div className="flex items-center">
            <p className="text-muted-foreground">
              {selectedCertificate ? (
                <span>
                  Current certificate:{" "}
                  <span className="inline-flex items-center text-xs font-bold text-primary">
                    {selectedCertificate.serial} <Check color="secondary" className="ml-2" />
                  </span>
                </span>
              ) : (
                "No local certificate."
              )}
            </p>

            {selectedCertificate && !isLocalCertMatching && (
              <CustomTooltip title="The local certificate doesn't match the one on the blockchain. You can revoke it and create a new one.">
                <WarningTriangle className="ml-2 text-sm text-destructive" />
              </CustomTooltip>
            )}
          </div>

          {!selectedCertificate && (
            <div className="ml-4">
              <Button variant="default" color="secondary" size="sm" disabled={isCreatingCert || isLoadingCertificates} onClick={() => createCertificate()}>
                {isCreatingCert ? <Spinner size="small" /> : "Create Certificate"}
              </Button>
            </div>
          )}

          <Button
            onClick={() => loadValidCertificates(true)}
            aria-label="refresh"
            disabled={isLoadingCertificates}
            size="icon"
            variant="outline"
            className="ml-4"
          >
            {isLoadingCertificates ? <Spinner size="small" /> : <Refresh />}
          </Button>

          {selectedCertificate && (
            <div className="ml-2">
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost">
                    <MoreHoriz />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {/** If local, regenerate else create */}
                  {selectedCertificate.parsed === localCert?.certPem ? (
                    <CustomDropdownLinkItem onClick={() => onRegenerateCert()} icon={<MdAutorenew />}>
                      Regenerate
                    </CustomDropdownLinkItem>
                  ) : (
                    <CustomDropdownLinkItem onClick={() => createCertificate()} icon={<PlusCircle />}>
                      Create
                    </CustomDropdownLinkItem>
                  )}

                  <CustomDropdownLinkItem onClick={() => onRevokeCert()} icon={<BinMinusIn />}>
                    Revoke
                  </CustomDropdownLinkItem>
                  <CustomDropdownLinkItem onClick={() => setIsExportingCert(true)} icon={<MdGetApp />}>
                    Export
                  </CustomDropdownLinkItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </FormPaper>
      )}

      {isExportingCert && <ExportCertificate isOpen={isExportingCert} onClose={() => setIsExportingCert(false)} />}
    </>
  );
}
