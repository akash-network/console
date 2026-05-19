import type { Metadata } from "next";

import AddressLayout from "../AddressLayout";
import { AddressTransactions } from "./AddressTransactions";

import { UrlService } from "@/lib/urlUtils";

export async function generateMetadata({ params }: IProps): Promise<Metadata> {
  const { address } = await params;
  const url = `https://stats.akash.network${UrlService.addressTransactions(address)}`;

  return {
    title: `Account ${address} transactions`,
    alternates: {
      canonical: url
    },
    openGraph: {
      url
    }
  };
}

interface IProps {
  params: Promise<{ address: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AddressTransactionsPage({ params }: IProps) {
  const { address } = await params;
  return (
    <AddressLayout page="transactions" address={address}>
      <div className="mt-4">
        <AddressTransactions address={address} />
      </div>
    </AddressLayout>
  );
}
