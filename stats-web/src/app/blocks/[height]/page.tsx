// import Box from "@mui/material/Box";
// import Paper from "@mui/material/Paper";
// import { useTheme } from "@mui/material/styles";
// import { makeStyles } from "tss-react/mui";
// import Layout from "@src/components/layout/Layout";
// import PageContainer from "@src/components/shared/PageContainer";
// import { getNetworkBaseApiUrl } from "@src/utils/constants";
import axios, { AxiosError } from "axios";
// import { BlockDetail } from "@src/types";
import { FormattedDate, FormattedRelativeTime } from "react-intl";
// import TableContainer from "@mui/material/TableContainer";
// import TableBody from "@mui/material/TableBody";
// import TableRow from "@mui/material/TableRow";
// import TableCell from "@mui/material/TableCell";
// import Table from "@mui/material/Table";
import Link from "next/link";
import { BlockDetail } from "@/types";
import { getNetworkBaseApiUrl } from "@/lib/constants";
import { Metadata, ResolvingMetadata } from "next";
import PageContainer from "@/components/PageContainer";
import { Title } from "@/components/Title";
import { LabelValue } from "@/components/LabelValue";
import { UrlService } from "@/lib/urlUtils";
// import { UrlService } from "@src/utils/urlUtils";
// import SearchOffIcon from "@mui/icons-material/SearchOff";
// import { LabelValue } from "@src/components/shared/LabelValue";
// import { Title } from "@src/components/shared/Title";
// import { NextSeo } from "next-seo";
// import { CustomTableHeader } from "@src/components/shared/CustomTable";
// import { TransactionRow } from "@src/components/blockchain/TransactionRow";
import { SearchX } from "lucide-react";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { TransactionRow } from "@/components/blockchain/TransactionRow";

interface IProps {
  params: { height: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

export async function generateMetadata({ params: { height } }: IProps, parent: ResolvingMetadata): Promise<Metadata> {
  return {
    title: `Block #${height}`
  };
}

async function fetchBlockData(height: string, network: string): Promise<BlockDetail> {
  const apiUrl = getNetworkBaseApiUrl(network);
  const response = await fetch(`${apiUrl}/blocks/${height}`);

  if (!response.ok) {
    // This will activate the closest `error.js` Error Boundary
    throw new Error("Error fetching block data");
  }

  return response.json();
}

export default async function BlockDetailPage({ params: { height }, searchParams: { network } }: IProps) {
  const block = await fetchBlockData(height, network as string);

  return (
    <PageContainer>
      <Title>Details for Block #{height}</Title>
      {/* <Paper sx={{ padding: 2 }} elevation={2}> */}
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
      {/* </Paper> */}

      <div className="mt-4">
        <Title subTitle className="mb-4">
          Transactions
        </Title>

        {/* <Paper sx={{ padding: 2 }}> */}
        {block.transactions.length === 0 ? (
          <div className="flex items-center p-4">
            <SearchX size="1rem" />
            &nbsp; No transactions
          </div>
        ) : (
          <Table>
            <TableHeader>
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
            </TableHeader>

            <TableBody>
              {block.transactions.map(transaction => (
                <TransactionRow key={transaction.hash} transaction={transaction} blockHeight={block.height} />
              ))}
            </TableBody>
          </Table>
        )}
        {/* </Paper> */}
      </div>
    </PageContainer>
  );
}

// export async function getServerSideProps({ params, query }) {
//   try {
//     const block = await fetchBlockData(params?.height, query.network as string);

//     return {
//       props: {
//         height: params?.height,
//         block
//       }
//     };
//   } catch (error) {
//     if (error.response?.status === 404 || error.response?.status === 400) {
//       return {
//         notFound: true
//       };
//     } else {
//       throw error;
//     }
//   }
// }
