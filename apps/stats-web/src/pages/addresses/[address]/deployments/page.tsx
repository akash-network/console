import { Helmet } from "react-helmet-async";
import { useParams } from "react-router-dom";

import AddressLayout from "../AddressLayout";
import { AddressDeployments } from "./AddressDeployments";

export function AddressDeploymentsPage() {
  const { address } = useParams<{ address: string }>();

  return (
    <>
      <Helmet>
        <title>Account {address} deployments - Akash Network Stats</title>
      </Helmet>
      <AddressLayout page="deployments" address={address || ""}>
        <div className="mt-4">
          <AddressDeployments address={address || ""} />
        </div>
      </AddressLayout>
    </>
  );
}
