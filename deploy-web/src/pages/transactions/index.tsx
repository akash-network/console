import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import { useTheme } from "@mui/material/styles";
import { makeStyles } from "tss-react/mui";
import Layout from "@src/components/layout/Layout";
import PageContainer from "@src/components/shared/PageContainer";
import TableContainer from "@mui/material/TableContainer";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import CircularProgress from "@mui/material/CircularProgress";
import { useTransactions } from "@src/queries/useTransactionsQuery";
import { Title } from "@src/components/shared/Title";
import { NextSeo } from "next-seo";
import { CustomTableHeader } from "@src/components/shared/CustomTable";
import { TransactionRow } from "@src/components/blockchain/TransactionRow";

type Props = {
  errors?: string;
};

const useStyles = makeStyles()(theme => ({}));

const TransactionsPage: React.FunctionComponent<Props> = ({}) => {
  const { classes } = useStyles();
  const theme = useTheme();
  const { data: transactions, isLoading } = useTransactions(20, {
    refetchInterval: 7000
  });

  return (
    <Layout>
      <NextSeo title="Transactions" />

      <PageContainer>
        <Title value="Transactions" />

        <Paper sx={{ padding: 2 }} elevation={2}>
          {isLoading ? (
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
              <CircularProgress color="secondary" />
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

                <TableBody>{transactions?.map(tx => <TransactionRow key={tx.hash} transaction={tx} blockHeight={tx.height} />)}</TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </PageContainer>
    </Layout>
  );
};

export default TransactionsPage;

export async function getServerSideProps({ params }) {
  return {
    props: {}
  };
}
