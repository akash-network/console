import { Table, TableBody, TableCell, TableContainer, TableRow, useTheme } from "@mui/material";
import { ClientProviderList } from "@src/types/provider";
import { CustomTableHeader } from "../shared/CustomTable";
import { ProviderListRow } from "./ProviderListRow";

type Props = {
  providers: Array<ClientProviderList>;
  sortOption: number;
};

export const ProviderList: React.FunctionComponent<Props> = ({ providers, sortOption }) => {
  const isSortingLeases = sortOption === 1 || sortOption === 2 || sortOption === 3 || sortOption === 4;

  return (
    <TableContainer>
      <Table size="small">
        <CustomTableHeader>
          <TableRow>
            <TableCell width="10%">Name</TableCell>
            <TableCell width="10%">Location</TableCell>
            <TableCell width="5%" align="center">
              Uptime (7d)
            </TableCell>
            <TableCell align="left" width="5%" sx={{ fontWeight: isSortingLeases ? "bold" : "normal" }}>
              Active Leases
            </TableCell>
            <TableCell align="center" width="15%">
              CPU
            </TableCell>
            <TableCell align="center" width="15%" sx={{ fontWeight: sortOption === 5 ? "bold" : "normal" }}>
              GPU
            </TableCell>
            <TableCell align="center" width="15%">
              Memory
            </TableCell>
            <TableCell align="center" width="15%">
              Disk
            </TableCell>
            <TableCell align="center" width="5%">
              Audited
            </TableCell>
            <TableCell align="center" width="5%">
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
