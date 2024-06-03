import { Metadata } from "next";

import { AddressInfo } from "./AddressInfo";
import AddressLayout from "./AddressLayout";
import { AssetAllocation } from "./AssetAllocation";
import { AssetList } from "./AssetList";
import { LatestTransactions } from "./LatestTransactions";

import { Title } from "@/components/Title";
import { getNetworkBaseApiUrl } from "@/lib/constants";
import { UrlService } from "@/lib/urlUtils";
import { AddressDetail } from "@/types";

interface IProps {
  params: { address: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

export async function generateMetadata({ params: { address } }: IProps): Promise<Metadata> {
  const url = `https://stats.akash.network${UrlService.address(address)}`;

  return {
    title: `Account ${address}`,
    alternates: {
      canonical: url
    },
    openGraph: {
      url
    }
  };
}

async function fetchAddressData(address: string, network: string): Promise<AddressDetail> {
  const apiUrl = getNetworkBaseApiUrl(network);
  const response = await fetch(`${apiUrl}/v1/addresses/${address}`);

  if (!response.ok) {
    // This will activate the closest `error.js` Error Boundary
    throw new Error("Error fetching address data");
  }

  return response.json();
}

export default async function AddressDetailPage({ params: { address }, searchParams: { network } }: IProps) {
  const addressDetail = await fetchAddressData(address, network as string);

  return (
    <AddressLayout page="address" address={address}>
      <AddressInfo address={address} addressDetail={addressDetail} />

      <div className="mt-4">
        <Title subTitle className="mb-4">
          Assets
        </Title>
        <div className="grid h-full grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="col-span-1">
            <AssetList addressDetail={addressDetail} />
          </div>
          <div className="col-span-1 md:col-span-3">
            <AssetAllocation addressDetail={addressDetail} />
          </div>
        </div>
      </div>

      <div className="mt-4">
        <Title subTitle className="mb-4">
          Latest Transactions
        </Title>

        <LatestTransactions addressDetail={addressDetail} />
      </div>
    </AddressLayout>
  );
}
