import { useCertificate } from "../../context/CertificateProvider";
import CheckIcon from "@mui/icons-material/Check";
import { FormattedDate } from "react-intl";
import { Box, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import { CertificateDisplay } from "./CertificateDisplay";
import { CustomTableHeader, CustomTableRow } from "../shared/CustomTable";
import { useKeplr } from "@src/context/KeplrWalletProvider";
import { ConnectWallet } from "../shared/ConnectWallet";

type Props = {};

export const CertificateList: React.FunctionComponent<Props> = ({}) => {
  const { validCertificates, localCert, selectedCertificate, revokeCertificate, revokeAllCertificates, isLoadingCertificates } = useCertificate();
  const { address } = useKeplr();

  return (
    <Box>
      <CertificateDisplay />

      {address ? (
        <TableContainer>
          <Table size="small">
            <CustomTableHeader>
              <TableRow>
                <TableCell align="center">Selected</TableCell>
                <TableCell align="center">Local cert</TableCell>
                <TableCell align="center">Issued on</TableCell>
                <TableCell align="center">Expires</TableCell>
                <TableCell align="center">Serial</TableCell>
                <TableCell align="center">
                  {validCertificates?.length > 0 && (
                    <Button onClick={() => revokeAllCertificates()} color="secondary" size="small" variant="outlined">
                      Revoke All
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            </CustomTableHeader>

            <TableBody>
              {validCertificates.map(cert => {
                const isCurrentCert = cert.serial === selectedCertificate?.serial;
                return (
                  <CustomTableRow key={cert.serial}>
                    <TableCell align="center">{isCurrentCert && <CheckIcon color="secondary" />}</TableCell>
                    <TableCell align="center">{cert.parsed === localCert?.certPem && <CheckIcon color="secondary" />}</TableCell>

                    <TableCell align="center">
                      <FormattedDate value={cert.pem.issuedOn} year="numeric" month="2-digit" day="2-digit" hour="2-digit" minute="2-digit" />
                    </TableCell>
                    <TableCell align="center">
                      <FormattedDate value={cert.pem.expiresOn} year="numeric" month="2-digit" day="2-digit" hour="2-digit" minute="2-digit" />
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="caption">{cert.serial}</Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Button
                        onClick={() => revokeCertificate(cert)}
                        color={isCurrentCert ? "secondary" : "inherit"}
                        size="small"
                        variant={isCurrentCert ? "contained" : "text"}
                      >
                        Revoke
                      </Button>
                    </TableCell>
                  </CustomTableRow>
                );
              })}
            </TableBody>
          </Table>

          {!isLoadingCertificates && validCertificates.length === 0 && (
            <Box sx={{ textAlign: "center", width: "100%", marginTop: "1rem" }}>
              <Typography variant="body2">No certificates.</Typography>
            </Box>
          )}
        </TableContainer>
      ) : (
        <ConnectWallet text="Connect your wallet to create a certficate." />
      )}
    </Box>
  );
};
