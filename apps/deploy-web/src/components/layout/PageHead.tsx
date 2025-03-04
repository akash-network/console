import React from "react";
import Head from "next/head";
import { DefaultSeo, NextSeo } from "next-seo";
import { NextSeoProps } from "next-seo/lib/types";

export const PageHead: React.FunctionComponent<{ pageSeo?: NextSeoProps }> = ({ pageSeo }) => {
  return (
    <>
      <Head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="minimum-scale=1, initial-scale=1, width=device-width, shrink-to-fit=no" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <DefaultSeo
        titleTemplate="%s | Akash Console"
        defaultTitle="Akash Console"
        description="Akash Console is the #1 platform to deploy docker containers on the Akash Network, a decentralized super cloud compute marketplace. Explore, deploy and track all in one place!"
        openGraph={{
          type: "website",
          locale: "en_US",
          url: "https://console.akash.network/",
          site_name: "Akash Console",
          description: "Deploy docker containers on the decentralized supercloud Akash Network.",
          images: [
            {
              url: "https://console.akash.network/akash-console.png",
              width: 1200,
              height: 630,
              alt: "AkashConsole Cover Image"
            }
          ]
        }}
        twitter={{
          handle: "@akashnet_",
          site: "@akashnet_",
          cardType: "summary_large_image"
        }}
      />

      <NextSeo {...pageSeo} />
    </>
  );
};
