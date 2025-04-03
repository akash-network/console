import React from "react";
import type { DocumentHeadTagsProps } from "@mui/material-nextjs/v14-pagesRouter";
import { documentGetInitialProps, DocumentHeadTags } from "@mui/material-nextjs/v14-pagesRouter";
import type { DocumentContext } from "next/document";
import { Head, Html, Main, NextScript } from "next/document";
import Script from "next/script";

import { customColors } from "@src/utils/colors";

export default function MyDocument(props: DocumentHeadTagsProps) {
  return (
    <Html suppressHydrationWarning>
      <Head>
        {/* MUI */}
        <DocumentHeadTags {...props} />

        {/* PWA */}
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="mask-icon" href="/safari-pinned-tab.svg" color={customColors.dark} />
        <meta name="msapplication-TileColor" content={customColors.dark} />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="theme-color" content={customColors.dark} />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@100;300;500;700;900&display=swap" rel="stylesheet" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>

      <Script async src="https://pxl.growth-channel.net/s/8d425860-cf3c-49cf-a459-069a7dc7b1f8"></Script>
      <Script async src="https://pxl.growth-channel.net/s/e94b4a7a-8431-4b9b-a679-290a1dbbab1b"></Script>
    </Html>
  );
}

MyDocument.getInitialProps = async (ctx: DocumentContext) => {
  const finalProps = await documentGetInitialProps(ctx);
  return finalProps;
};
