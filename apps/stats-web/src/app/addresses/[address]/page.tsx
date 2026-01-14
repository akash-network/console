import { LoggerService } from "@akashnetwork/logging";
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
import { serverFetch } from "@/lib/serverFetch";
import { UrlService } from "@/lib/urlUtils";
import { serverApiUrlService } from "@/services/api-url/server-api-url.service";
import type { AddressDetail } from "@/types";

const logger = new LoggerService({ context: "AddressDetailPage" });

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

async function fetchAddressData(address: string, network: Network["id"]): Promise<AddressDetail | null> {
  const apiUrl = serverApiUrlService.getBaseApiUrlFor(network);
  const response = await serverFetch(`${apiUrl}/v1/addresses/${address}`);

  if (!response.ok && response.status !== 404) {
    logger.error({ event: "ADDRESS_FETCH_ERROR", address, network, status: response.status });
    throw new Error(`Error fetching address data: ${address}`);
  } else if (response.status === 404) {
    logger.debug({ event: "ADDRESS_NOT_FOUND", address, network });
    return null;
  }

  return response.json();
}

export default async function AddressDetailPage(props: AddressDetailPageProps) {
  const {
    params: { address },
    searchParams: { network }
  } = AddressDetailPageSchema.parse(props);
  const addressDetail = await fetchAddressData(address, network);

  if (!addressDetail) {
    return (
      <AddressLayout page="address" address={address}>
        <div className="py-8 text-center text-muted-foreground">Address not found or not indexed yet. Please check the address and try again.</div>
      </AddressLayout>
    );
  }

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
