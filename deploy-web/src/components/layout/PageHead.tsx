import React, { ReactNode } from "react";
import Head from "next/head";
import { DefaultSeo } from "next-seo";

type Props = {
  children?: ReactNode;
};

const PageHead: React.FunctionComponent<Props> = ({}) => {
  return (
    <>
      <Head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="minimum-scale=1, initial-scale=1, width=device-width, shrink-to-fit=no" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <DefaultSeo
        title="Cloudmos"
        titleTemplate="%s | Cloudmos"
        description="Cloudmos is the #1 platform to deploy docker containers on the Akash Network, a decentralized cloud compute marketplace. Explore, deploy and track all in one place!"
        openGraph={{
          type: "website",
          locale: "en_US",
          url: "https://cloudmos.io/",
          site_name: "Cloudmos",
          description: "Deploy docker containers on the decentralized supercloud Akash Network.",
          images: [
            {
              url: 'https://www.cloudmos.io/cloudmos-cover.png',
              width: 800,
              height: 600,
              alt: 'Og Image Alt',
            }
          ],
        }}
        twitter={{
          handle: "@cloudmosio",
          site: "@cloudmosio",
          cardType: "summary_large_image"
        }}
      />
    </>
  );
};
export default PageHead;
