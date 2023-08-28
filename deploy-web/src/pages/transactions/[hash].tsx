import React from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import { useTheme } from "@mui/material/styles";
import { makeStyles } from "tss-react/mui";
import Layout from "@src/components/layout/Layout";
import PageContainer from "@src/components/shared/PageContainer";
import { BASE_API_MAINNET_URL, BASE_API_TESTNET_URL } from "@src/utils/constants";
import axios from "axios";
import { TransactionDetail } from "@src/types";
import { FormattedDate, FormattedRelativeTime } from "react-intl";
import Link from "next/link";
import { UrlService } from "@src/utils/urlUtils";
import { getSplitText } from "@src/hooks/useShortText";
import { LabelValue } from "@src/components/shared/LabelValue";
import { Title } from "@src/components/shared/Title";
import { NextSeo } from "next-seo";
import { Alert } from "@mui/material";
import { AKTAmount } from "@src/components/shared/AKTAmount";
import { AddressLink } from "@src/components/shared/AddressLink";
import { TxMessageRow } from "@src/components/shared/TxMessages/TxMessageRow";

type Props = {
  hash: string;
  transaction: TransactionDetail;
};

const useStyles = makeStyles()(theme => ({}));

const TransactionDetailPage: React.FunctionComponent<Props> = ({ transaction, hash }) => {
  const { classes } = useStyles();
  const theme = useTheme();
  const splittedTxHash = getSplitText(hash, 6, 6);

  return (
    <Layout>
      <NextSeo title={`Tx ${splittedTxHash}`} />

      <PageContainer>
        <Title value="Transaction Details" />

        <Paper sx={{ padding: 2 }} elevation={2}>
          <LabelValue label="Hash" value={transaction.hash} />
          <LabelValue label="Status" value={transaction.isSuccess ? "Success" : "Failed"} />
          <LabelValue label="Height" value={<Link href={UrlService.block(transaction.height)}>{transaction.height}</Link>} />
          <LabelValue
            label="Time"
            value={
              <>
                <FormattedRelativeTime
                  value={(new Date(transaction.datetime).getTime() - new Date().getTime()) / 1000}
                  numeric="auto"
                  unit="second"
                  updateIntervalInSeconds={7}
                />
                &nbsp;(
                <FormattedDate value={transaction.datetime} year="numeric" month="2-digit" day="2-digit" hour="2-digit" minute="2-digit" second="2-digit" />)
              </>
            }
          />
          <LabelValue label="Fee" value={<AKTAmount uakt={transaction.fee} showAKTLabel />} />
          <LabelValue label="Gas (used/wanted)" value={`${transaction.gasUsed} / ${transaction.gasWanted}`} />
          {transaction.multisigThreshold && <LabelValue label="Multisig Threshold" value={transaction.multisigThreshold} />}
          <LabelValue
            label={transaction.signers.length > 1 ? "Signers" : "Signer"}
            value={
              <>
                {transaction.signers.map(signer => (
                  <React.Fragment key={signer}>
                    <AddressLink address={signer} />
                    <br />
                  </React.Fragment>
                ))}
              </>
            }
          />
          <LabelValue label="Memo" value={transaction.memo} />

          {transaction.error && (
            <Alert severity="error" variant="outlined">
              {transaction.error}
            </Alert>
          )}
        </Paper>

        <Box sx={{ mt: "1rem" }}>
          <Title value="Messages" subTitle sx={{ marginBottom: "1rem" }} />

          {transaction.messages.map(msg => (
            <Paper key={msg.id} sx={{ padding: 0, mb: 2 }}>
              <TxMessageRow message={msg} />
            </Paper>
          ))}
        </Box>
      </PageContainer>
    </Layout>
  );
};

export default TransactionDetailPage;

export async function getServerSideProps({ params, query }) {
  try {
    const transaction = await fetchTransactionData(params?.hash, query.network as string);

    return {
      props: {
        hash: params?.hash,
        transaction
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

async function fetchTransactionData(hash: string, network: string) {
  const apiUrl = network === "testnet" ? BASE_API_TESTNET_URL : BASE_API_MAINNET_URL;
  const response = await axios.get(`${apiUrl}/transactions/${hash}`);
  return response.data;
}
