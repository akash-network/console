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
        titleTemplate="%s | Cloudmos"
        description="Cloudmos is the #1 platform to deploy docker containers on the Akash Network, a decentralized cloud compute marketplace. Explore, deploy and track all in one place!"
        // openGraph={{
        //   type: "website",
        //   locale: "en_IE",
        //   url: "https://www.url.ie/",
        //   site_name: "SiteName"
        // }}
        // twitter={{
        //   handle: "@handle",
        //   site: "@site",
        //   cardType: "summary_large_image"
        // }}
      />
    </>
  );
};
export default PageHead;
