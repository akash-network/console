// import Box from "@mui/material/Box";
// import Paper from "@mui/material/Paper";
// import { useTheme } from "@mui/material/styles";
// import { makeStyles } from "tss-react/mui";
// import Layout from "@src/components/layout/Layout";
// import PageContainer from "@src/components/shared/PageContainer";
// import { getNetworkBaseApiUrl } from "@src/utils/constants";
// import axios, { AxiosError } from "axios";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TransactionRow } from "@/components/blockchain/TransactionRow";
import { BlockInfo } from "./BlockInfo";
import { Card, CardContent } from "@/components/ui/card";

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
      <Title className="mb-4">Details for Block #{height}</Title>

      <BlockInfo block={block} />

      <div className="mt-6">
        <Title subTitle className="mb-4">
          Transactions
        </Title>

        <Card>
          <CardContent className="pt-6">
            {block.transactions.length === 0 ? (
              <div className="flex items-center p-4">
                <SearchX size="1rem" />
                &nbsp; No transactions
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tx Hash</TableHead>
                    <TableHead className="text-center">Type</TableHead>
                    <TableHead className="text-center">Result</TableHead>
                    <TableHead className="text-center">Amount</TableHead>
                    <TableHead className="text-center">Fee</TableHead>
                    <TableHead className="text-center">Height</TableHead>
                    <TableHead className="text-center">Time</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {block.transactions.map(transaction => (
                    <TransactionRow key={transaction.hash} transaction={transaction} blockHeight={block.height} />
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
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
