import { Helmet } from "react-helmet-async";
import { useParams } from "react-router-dom";

import AddressLayout from "../AddressLayout";
import { AddressTransactions } from "./AddressTransactions";

export function AddressTransactionsPage() {
  const { address } = useParams<{ address: string }>();

  return (
    <>
      <Helmet>
        <title>Account {address} transactions - Akash Network Stats</title>
      </Helmet>
      <AddressLayout page="transactions" address={address || ""}>
        <div className="mt-4">
          <AddressTransactions address={address || ""} />
        </div>
      </AddressLayout>
    </>
  );
}
