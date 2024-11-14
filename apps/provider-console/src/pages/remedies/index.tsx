"use client";
import React from "react";
import { useRouter } from 'next/router'; // Import useRouter
import { useAtom } from "jotai";
import Layout from "@src/components/layout/Layout";
import withAuth from "@src/components/shared/withAuth";
import { Card } from "@akashnetwork/ui/components";
import providerProcessStore from "@src/store/providerProcessStore";

const Remedies: React.FunctionComponent = () => {
  const router = useRouter(); // Initialize useRouter
  const [, resetProviderProcess] = useAtom(providerProcessStore.resetProviderProcess);

  const handleBecomeProvider = () => {
    // Redirect to the /become-provider page
    resetProviderProcess();
    router.push('/become-provider');
  };

  return (
    <Layout>
      <Card className="mt-4 p-4">
        <h2 className="text-lg font-bold">Provider Not Online</h2>
        <ul className="list-disc pl-5">
          <li>Ensure DNS propagation is complete. This process can take up to 48 hours.</li>
          <li>Verify that ports 8443 and 8444 are correctly set and open in your firewall settings.</li>
          <li>Check if the control machine has crashed and restart it if necessary.</li>
        </ul>
        <button onClick={handleBecomeProvider} className="bg-primary mt-4 rounded px-4 py-2 text-white">
          Restart Provider Build
        </button>
      </Card>
    </Layout>
  );
};

export default withAuth(Remedies); // Wrap with the HOC
