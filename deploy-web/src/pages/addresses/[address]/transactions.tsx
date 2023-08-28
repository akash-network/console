import Box from "@mui/material/Box";
import Layout from "@src/components/layout/Layout";
import SearchOffIcon from "@mui/icons-material/SearchOff";
import { NextSeo } from "next-seo";
import { CircularProgress, Pagination, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from "@mui/material";
import { useState } from "react";
import { makeStyles } from "tss-react/mui";
import { useAddressTransactions } from "@src/queries/useTransactionsQuery";
import { CustomTableHeader } from "@src/components/shared/CustomTable";
import AddressLayout from "@src/components/address/AddressLayout";
import { TransactionRow } from "@src/components/blockchain/TransactionRow";

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

const AddressDetailPage: React.FunctionComponent<Props> = ({ address }) => {
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const { data: transactionsResult, isLoading } = useAddressTransactions(address, (page - 1) * pageSize, pageSize);
  const { classes } = useStyles();

  const pageCount = Math.ceil(transactionsResult?.count / pageSize);

  function handlePageChange(event: React.ChangeEvent<unknown>, value: number) {
    setPage(value);
  }

  return (
    <Layout>
      <NextSeo title={`Account ${address} transactions`} />

      <AddressLayout page="transactions" address={address}>
        <Paper sx={{ mt: "1rem", padding: "1rem" }}>
          {transactionsResult?.results.length === 0 ? (
            <Box sx={{ padding: "1rem", display: "flex", alignItems: "center" }}>
              <SearchOffIcon />
              &nbsp;This address has no transactions
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <CustomTableHeader>
                  <TableRow>
                    <TableCell width="10%">Tx Hash</TableCell>
                    <TableCell align="center" width="20%">
                      Type
                    </TableCell>
                    <TableCell align="center" width="10%">
                      Result
                    </TableCell>
                    <TableCell align="center" width="10%">
                      Amount
                    </TableCell>
                    <TableCell align="center" width="10%">
                      Fee
                    </TableCell>
                    <TableCell align="center" width="5%">
                      Height
                    </TableCell>
                    <TableCell align="center" width="5%">
                      Time
                    </TableCell>
                  </TableRow>
                </CustomTableHeader>

                <TableBody>{transactionsResult?.results.map(tx => <TransactionRow key={tx.hash} transaction={tx} blockHeight={tx.height} />)}</TableBody>
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
      </AddressLayout>
    </Layout>
  );
};

export default AddressDetailPage;

export async function getServerSideProps({ params }) {
  return {
    props: {
      address: params?.address
    }
  };
}
