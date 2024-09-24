"use client";
import { useState, useEffect } from "react";
import { FormattedDate } from "react-intl";
import { Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, CustomPagination } from "@akashnetwork/ui/components";
import { Check } from "iconoir-react";

import { ConnectWallet } from "@src/components/shared/ConnectWallet";
import { useCertificate } from "@src/context/CertificateProvider";
import { useWallet } from "@src/context/WalletProvider";
import { CertificateDisplay } from "./CertificateDisplay";

export const CertificateList: React.FunctionComponent = () => {
  const { validCertificates, localCert, selectedCertificate, revokeCertificate, revokeAllCertificates, isLoadingCertificates } = useCertificate();
  const { address } = useWallet();
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState<number>(10);
  const sortedValidCertificates = [...validCertificates].sort((a, b) => {
    return new Date(b.pem.issuedOn).getTime() - new Date(a.pem.issuedOn).getTime();
  });
  const start = pageIndex * pageSize;
  const end = start + pageSize;
  const currentPageCertificates = sortedValidCertificates.slice(start, end);
  const pageCount = Math.ceil(sortedValidCertificates.length / pageSize);

  const handleChangePage = (newPage: number) => {
    setPageIndex(newPage);
  };

  const onPageSizeChange = (value: number) => {
    setPageSize(value);
    setPageIndex(0);
  };

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
              {currentPageCertificates.map(cert => {
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

          {validCertificates.length > 0 && (
            <div className="flex items-center justify-center py-8">
              <CustomPagination
                totalPageCount={pageCount}
                setPageIndex={handleChangePage}
                pageIndex={pageIndex}
                pageSize={pageSize}
                setPageSize={onPageSizeChange}
              />
            </div>
          )}
        </div>
      ) : (
        <ConnectWallet text="Connect your wallet to create a certficate." />
      )}
    </div>
  );
};
