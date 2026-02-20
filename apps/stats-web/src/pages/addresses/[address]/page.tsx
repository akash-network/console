import { Spinner } from "@akashnetwork/ui/components";
import { Helmet } from "react-helmet-async";
import { useParams } from "react-router-dom";

import { AddressInfo } from "./AddressInfo";
import AddressLayout from "./AddressLayout";
import { AssetAllocation } from "./AssetAllocation";
import { AssetList } from "./AssetList";
import { LatestTransactions } from "./LatestTransactions";

import { Title } from "@/components/Title";
import { useAddress } from "@/queries";

export function AddressDetailPage() {
  const { address } = useParams<{ address: string }>();
  const { data: addressDetail, isLoading, error } = useAddress(address || "");

  if (isLoading) {
    return (
      <AddressLayout page="address" address={address || ""}>
        <div className="flex items-center justify-center p-8">
          <Spinner size="large" />
        </div>
      </AddressLayout>
    );
  }

  if (error || !addressDetail) {
    return (
      <>
        <Helmet>
          <title>Account {address} - Akash Network Stats</title>
        </Helmet>
        <AddressLayout page="address" address={address || ""}>
          <div className="py-8 text-center text-muted-foreground">Address not found or not indexed yet. Please check the address and try again.</div>
        </AddressLayout>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Account {address} - Akash Network Stats</title>
      </Helmet>
      <AddressLayout page="address" address={address || ""}>
        <AddressInfo address={address || ""} addressDetail={addressDetail} />

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
    </>
  );
}
