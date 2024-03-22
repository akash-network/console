import { Table, TableBody, TableCell, TableContainer, TableRow, useTheme } from "@mui/material";
import { ClientProviderList } from "@src/types/provider";
import { CustomTableHeader } from "../../components/shared/CustomTable";
import { ProviderListRow } from "./ProviderTableRow";

type Props = {
  providers: Array<ClientProviderList>;
  sortOption: string;
};

export const ProviderTable: React.FunctionComponent<Props> = ({ providers, sortOption }) => {
  const isSortingLeases =
    sortOption === "active-leases-desc" || sortOption === "active-leases-asc" || sortOption === "my-leases-desc" || sortOption === "my-active-leases-desc";

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
            <TableCell align="center" width="15%" sx={{ fontWeight: sortOption === "gpu-available-desc" ? "bold" : "normal" }}>
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
