import { useState } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import { useTheme } from "@mui/material/styles";
import Layout from "@src/components/layout/Layout";
import { NextSeo } from "next-seo";
import {
  CircularProgress,
  FormControl,
  MenuItem,
  Pagination,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel
} from "@mui/material";
import { makeStyles } from "tss-react/mui";
import { useAddressDeployments } from "@src/queries/useTransactionsQuery";
import SearchOffIcon from "@mui/icons-material/SearchOff";
import AddressLayout from "@src/components/address/AddressLayout";
import { DeploymentRow } from "@src/components/deployment/DeploymentRow";

type Props = {
  address: string;
};

export const useStyles = makeStyles()(theme => ({
  loading: { textAlign: "center", marginTop: "4rem", marginBottom: "1rem" },
  pagerContainer: {
    marginTop: 10,
    display: "flex",
    justifyContent: "center"
  }
}));

const AddressDeploymentsPage: React.FunctionComponent<Props> = ({ address }) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState("*");
  const [isSortingReversed, setIsSortingReversed] = useState(true);
  const { data: deploymentsResult, isLoading } = useAddressDeployments(address, (page - 1) * pageSize, pageSize, isSortingReversed, { status: statusFilter });
  const { classes } = useStyles();
  const theme = useTheme();

  const pageCount = Math.ceil(deploymentsResult?.count / pageSize);

  function handlePageChange(event: React.ChangeEvent<unknown>, value: number) {
    setPage(value);
  }

  const handleRequestSort = (event: React.MouseEvent<unknown>) => {
    setIsSortingReversed(current => !current);
  };

  return (
    <Layout>
      <NextSeo title={`Account ${address} deployments`} />

      <AddressLayout page="deployments" address={address}>
        <Box sx={{ mt: "1rem" }}>
          <Paper sx={{ mt: "1rem", padding: "1rem" }}>
            {deploymentsResult?.results.length === 0 && statusFilter === "*" ? (
              <Box sx={{ padding: "1rem", display: "flex", alignItems: "center" }}>
                <SearchOffIcon />
                &nbsp;This address has no deployments
              </Box>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell width="10%">
                        <TableSortLabel active={true} direction={isSortingReversed ? "desc" : "asc"} onClick={handleRequestSort}>
                          DSEQ
                        </TableSortLabel>
                      </TableCell>
                      <TableCell align="center" width="10%">
                        Status
                      </TableCell>
                      <TableCell width="10%">Created Height</TableCell>
                      <TableCell width="20%">Specs</TableCell>
                    </TableRow>

                    <TableRow>
                      <TableCell></TableCell>
                      <TableCell>
                        <FormControl fullWidth size="small">
                          <Select value={statusFilter} onChange={ev => setStatusFilter(ev.target.value)} MenuProps={{ disableScrollLock: true }}>
                            <MenuItem value={"*"}>All</MenuItem>
                            <MenuItem value={"active"}>Active</MenuItem>
                            <MenuItem value={"closed"}>Closed</MenuItem>
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {deploymentsResult?.results.map(deployment => (
                      <DeploymentRow key={deployment.dseq} deployment={deployment} />
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
            {isLoading && (
              <div className={classes.loading}>
                <CircularProgress size={60} color="secondary" />
              </div>
            )}
            {!!pageCount && (
              <div className={classes.pagerContainer}>
                <Pagination count={pageCount} page={page} onChange={handlePageChange} size="medium" />
              </div>
            )}
          </Paper>
        </Box>
      </AddressLayout>
    </Layout>
  );
};

export default AddressDeploymentsPage;

export async function getServerSideProps({ params }) {
  return {
    props: {
      address: params?.address
    }
  };
}
