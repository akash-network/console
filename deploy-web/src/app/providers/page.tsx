import React from "react";
import { Metadata } from "next";
import { ProviderList } from "./ProviderList";

export const metadata: Metadata = {
  title: "Providers"
};

{
  /* <CustomNextSeo
title="Providers"
url={`https://deploy.cloudmos.io${UrlService.providers()}`}
description="Explore all the providers available on the Akash Network."
/> */
}

export default function Home() {
  return <ProviderList />;
}
