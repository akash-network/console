import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import { useTheme } from "@mui/material/styles";
import { makeStyles } from "tss-react/mui";
import Layout from "@src/components/layout/Layout";
import PageContainer from "@src/components/shared/PageContainer";
import { BASE_API_MAINNET_URL, BASE_API_TESTNET_URL } from "@src/utils/constants";
import axios from "axios";
import { BlockDetail } from "@src/types";
import { FormattedDate, FormattedRelativeTime } from "react-intl";
import TableContainer from "@mui/material/TableContainer";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import Table from "@mui/material/Table";
import Link from "next/link";
import { UrlService } from "@src/utils/urlUtils";
import SearchOffIcon from "@mui/icons-material/SearchOff";
import { LabelValue } from "@src/components/shared/LabelValue";
import { Title } from "@src/components/shared/Title";
import { NextSeo } from "next-seo";
import { CustomTableHeader } from "@src/components/shared/CustomTable";
import { TransactionRow } from "@src/components/blockchain/TransactionRow";

type Props = {
  height: string;
  block: BlockDetail;
};

const useStyles = makeStyles()(theme => ({}));

const BlockDetailPage: React.FunctionComponent<Props> = ({ height, block }) => {
  const { classes } = useStyles();
  const theme = useTheme();

  return (
    <Layout>
      <NextSeo title={`Block #${height}`} />

      <PageContainer>
        <Title value={`Details for Block #${height}`} />
        <Paper sx={{ padding: 2 }} elevation={2}>
          <LabelValue label="Height" value={block.height} />
          <LabelValue label="Poposer" value={<Link href={UrlService.validator(block.proposer.operatorAddress)}>{block.proposer.moniker}</Link>} />
          <LabelValue
            label="Block Time"
            value={
              <>
                <FormattedRelativeTime
                  value={(new Date(block.datetime).getTime() - new Date().getTime()) / 1000}
                  numeric="auto"
                  unit="second"
                  updateIntervalInSeconds={7}
                />
                &nbsp;(
                <FormattedDate value={block.datetime} year="numeric" month="2-digit" day="2-digit" hour="2-digit" minute="2-digit" second="2-digit" />)
              </>
            }
          />
          <LabelValue label="Block Hash" value={block.hash} />
          <LabelValue label="# of Transactions" value={block.transactions.length} />
          <LabelValue label="Gas wanted / used" value={block.gasUsed === 0 || block.gasWanted === 0 ? 0 : `${block.gasUsed} / ${block.gasWanted}`} />
        </Paper>

        <Box sx={{ mt: "1rem" }}>
          <Title value="Transactions" subTitle sx={{ marginBottom: "1rem" }} />

          <Paper sx={{ padding: 2 }}>
            {block.transactions.length === 0 ? (
              <Box sx={{ padding: "1rem", display: "flex", alignItems: "center" }}>
                <SearchOffIcon />
                &nbsp; No transactions
              </Box>
            ) : (
              <TableContainer>
                <Table size="small">
                  <CustomTableHeader>
                    <TableRow>
                      <TableCell width="5%">Tx Hash</TableCell>
                      <TableCell align="center" width="10%">
                        Type
                      </TableCell>
                      <TableCell align="center">Result</TableCell>
                      <TableCell align="center">Amount</TableCell>
                      <TableCell align="center">Fee</TableCell>
                      <TableCell align="center">Height</TableCell>
                      <TableCell align="center">Time</TableCell>
                    </TableRow>
                  </CustomTableHeader>

                  <TableBody>
                    {block.transactions.map(transaction => (
                      <TransactionRow key={transaction.hash} transaction={transaction} blockHeight={block.height} />
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Box>
      </PageContainer>
    </Layout>
  );
};

export default BlockDetailPage;

export async function getServerSideProps({ params, query }) {
  try {
    const block = await fetchBlockData(params?.height, query.network as string);

    return {
      props: {
        height: params?.height,
        block
      }
    };
  } catch (error) {
    if (error.response?.status === 404 || error.response?.status === 400) {
      return {
        notFound: true
      };
    } else {
      throw error;
    }
  }
}

async function fetchBlockData(height: string, network: string) {
  const apiUrl = network === "testnet" ? BASE_API_TESTNET_URL : BASE_API_MAINNET_URL;
  const response = await axios.get(`${apiUrl}/blocks/${height}`);
  return response.data;
}
