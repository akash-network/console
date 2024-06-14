"use client";
import { FormattedDate } from "react-intl";
import { Check } from "iconoir-react";

import { ConnectWallet } from "@src/components/shared/ConnectWallet";
import { Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@akashnetwork/ui/components";
import { useCertificate } from "@src/context/CertificateProvider";
import { useWallet } from "@src/context/WalletProvider";
import { CertificateDisplay } from "./CertificateDisplay";

export const CertificateList: React.FunctionComponent = () => {
  const { validCertificates, localCert, selectedCertificate, revokeCertificate, revokeAllCertificates, isLoadingCertificates } = useCertificate();
  const { address } = useWallet();

  return (
    <div>
      <CertificateDisplay />

      {address ? (
        <div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-center">Selected</TableHead>
                <TableHead className="text-center">Local cert</TableHead>
                <TableHead className="text-center">Issued on</TableHead>
                <TableHead className="text-center">Expires</TableHead>
                <TableHead className="text-center">Serial</TableHead>
                <TableHead className="text-center">
                  {validCertificates?.length > 0 && (
                    <Button onClick={() => revokeAllCertificates()} color="secondary" size="sm" variant="outline">
                      Revoke All
                    </Button>
                  )}
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {validCertificates.map(cert => {
                const isCurrentCert = cert.serial === selectedCertificate?.serial;
                return (
                  <TableRow key={cert.serial}>
                    <TableCell align="center">{isCurrentCert && <Check className="text-primary" />}</TableCell>
                    <TableCell align="center">{cert.parsed === localCert?.certPem && <Check className="text-primary" />}</TableCell>

                    <TableCell align="center">
                      <FormattedDate value={cert.pem.issuedOn} year="numeric" month="2-digit" day="2-digit" hour="2-digit" minute="2-digit" />
                    </TableCell>
                    <TableCell align="center">
                      <FormattedDate value={cert.pem.expiresOn} year="numeric" month="2-digit" day="2-digit" hour="2-digit" minute="2-digit" />
                    </TableCell>
                    <TableCell align="center">
                      <p className="text-sm text-muted-foreground">{cert.serial}</p>
                    </TableCell>
                    <TableCell align="center">
                      <Button
                        onClick={() => revokeCertificate(cert)}
                        color={isCurrentCert ? "secondary" : "inherit"}
                        size="sm"
                        variant={isCurrentCert ? "default" : "text"}
                      >
                        Revoke
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {!isLoadingCertificates && validCertificates.length === 0 && (
            <div className="mt-4 w-full text-center">
              <p>No certificates.</p>
            </div>
          )}
        </div>
      ) : (
        <ConnectWallet text="Connect your wallet to create a certficate." />
      )}
    </div>
  );
};
