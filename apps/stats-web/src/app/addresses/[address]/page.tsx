import type { Network } from "@akashnetwork/network-store";
import type { Metadata } from "next";
import { z } from "zod";

import { AddressInfo } from "./AddressInfo";
import AddressLayout from "./AddressLayout";
import { AssetAllocation } from "./AssetAllocation";
import { AssetList } from "./AssetList";
import { LatestTransactions } from "./LatestTransactions";

import { Title } from "@/components/Title";
import { networkId } from "@/config/env-config.schema";
import { UrlService } from "@/lib/urlUtils";
import { serverApiUrlService } from "@/services/api-url/server-api-url.service";
import { AddressDetail } from "@/types";

const AddressDetailPageSchema = z.object({
  params: z.object({
    address: z.string()
  }),
  searchParams: z.object({
    network: networkId
  })
});
type AddressDetailPageProps = z.infer<typeof AddressDetailPageSchema>;

export async function generateMetadata({ params: { address } }: AddressDetailPageProps): Promise<Metadata> {
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

async function fetchAddressData(address: string, network: Network["id"]): Promise<AddressDetail> {
  const apiUrl = serverApiUrlService.getBaseApiUrlFor(network);
  const response = await fetch(`${apiUrl}/v1/addresses/${address}`);

  if (!response.ok) {
    // This will activate the closest `error.js` Error Boundary
    throw new Error("Error fetching address data");
  }

  return response.json();
}

export default async function AddressDetailPage(props: AddressDetailPageProps) {
  const {
    params: { address },
    searchParams: { network }
  } = AddressDetailPageSchema.parse(props);
  const addressDetail = await fetchAddressData(address, network);

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
