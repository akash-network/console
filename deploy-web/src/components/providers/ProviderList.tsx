import { Table, TableBody, TableCell, TableContainer, TableRow, useTheme } from "@mui/material";
import { MergedProvider } from "@src/types/provider";
import { CustomTableHeader } from "../shared/CustomTable";
import { ProviderListRow } from "./ProviderListRow";

type Props = {
  providers: Array<MergedProvider>;
};

export const ProviderList: React.FunctionComponent<Props> = ({ providers }) => {
  return (
    <TableContainer>
      <Table size="small">
        <CustomTableHeader>
          <TableRow>
            <TableCell width="20%">Name</TableCell>
            <TableCell width="10%">Location</TableCell>
            <TableCell width="10%" align="center">
              Uptime (7d)
            </TableCell>
            <TableCell align="center" width="10%">
              Active Leases
            </TableCell>
            <TableCell align="center" width="10%">
              My active leases
            </TableCell>
            <TableCell align="center" width="10%">
              CPU
            </TableCell>
            <TableCell align="center" width="10%">
              GPU
            </TableCell>
            <TableCell align="center" width="10%">
              Memory
            </TableCell>
            <TableCell align="center" width="10%">
              Disk
            </TableCell>
            <TableCell align="center" width="10%">
              Audited
            </TableCell>
            <TableCell align="center" width="10%">
              Favorite
            </TableCell>
          </TableRow>
        </CustomTableHeader>

        <TableBody>
          {providers.map(provider => {
            return <ProviderListRow key={provider.owner} provider={provider} />;
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
