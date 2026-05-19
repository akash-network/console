import type { Metadata } from "next";

import AddressLayout from "../AddressLayout";
import { AddressDeployments } from "./AddressDeployments";

import { UrlService } from "@/lib/urlUtils";

export async function generateMetadata({ params }: IProps): Promise<Metadata> {
  const { address } = await params;
  const url = `https://stats.akash.network${UrlService.addressDeployments(address)}`;

  return {
    title: `Account ${address} deployments`,
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

export default async function AddressDeploymentsPage({ params }: IProps) {
  const { address } = await params;
  return (
    <AddressLayout page="deployments" address={address}>
      <div className="mt-4">
        <AddressDeployments address={address} />
      </div>
    </AddressLayout>
  );
}
