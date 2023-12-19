import { UrlService } from "@/lib/urlUtils";
import { Metadata, ResolvingMetadata } from "next";
import AddressLayout from "../AddressLayout";
import { AddressDeployments } from "./AddressDeployments";

export async function generateMetadata({ params: { address } }: IProps, parent: ResolvingMetadata): Promise<Metadata> {
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
  params: { address: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

export default async function AddressDeploymentsPage({ params: { address } }: IProps) {
  return (
    <AddressLayout page="deployments" address={address}>
      <div className="mt-4">
        {/* <Paper sx={{ mt: "1rem", padding: "1rem" }}>
            
          </Paper> */}
        <AddressDeployments address={address} />
      </div>
    </AddressLayout>
  );
}
