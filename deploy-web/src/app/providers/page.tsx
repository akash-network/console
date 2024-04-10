import React from "react";
import { Metadata } from "next";
import { ProviderList } from "./ProviderList";
import { UrlService } from "@src/utils/urlUtils";

export async function generateMetadata(): Promise<Metadata> {
  const url = `https://deploy.cloudmos.io${UrlService.providers()}`;

  return {
    title: "Providers",
    description: "Explore all the providers available on the Akash Network.",
    alternates: {
      canonical: url
    },
    openGraph: {
      url
    }
  };
}

export default function Home() {
  return <ProviderList />;
}
