import { useWallet } from "@cosmos-kit/react";
import { HomeContainer } from "@src/components/home/HomeContainer";
import Layout from "@src/components/layout/Layout";
import { useEffect } from "react";

export default function Home() {
  const wallet = useWallet();

  // check if which page is to load here
  useEffect(() => {
    console.log(wallet);
  }, [wallet]);

  return (
    <Layout containerClassName="flex h-full flex-col justify-between" isLoading={false}>
      {wallet.status === "Connected" && <HomeContainer />}
      {!wallet.status === "disconnected" && <div>wallet is not connected</div>}
    </Layout>
  );
}
