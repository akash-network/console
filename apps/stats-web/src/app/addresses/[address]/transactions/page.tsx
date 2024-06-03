import { Metadata, ResolvingMetadata } from "next";

import AddressLayout from "../AddressLayout";
import { AddressTransactions } from "./AddressTransactions";

import { UrlService } from "@/lib/urlUtils";

export async function generateMetadata({ params: { address } }: IProps, parent: ResolvingMetadata): Promise<Metadata> {
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
  params: { address: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

export default async function AddressTransactionsPage({ params: { address } }: IProps) {
  return (
    <AddressLayout page="transactions" address={address}>
      <div className="mt-4">
        <AddressTransactions address={address} />
      </div>
    </AddressLayout>
  );
}
