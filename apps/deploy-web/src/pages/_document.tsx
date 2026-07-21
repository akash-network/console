import React from "react";
import type { DocumentHeadTagsProps } from "@mui/material-nextjs/v14-pagesRouter";
import { documentGetInitialProps, DocumentHeadTags } from "@mui/material-nextjs/v14-pagesRouter";
import { GeistSans } from "geist/font/sans";
import type { DocumentContext } from "next/document";
import { Head, Html, Main, NextScript } from "next/document";

import { customColors } from "@src/utils/colors";

export default function MyDocument(props: DocumentHeadTagsProps) {
  return (
    // Apply the Geist font variable at the document root so portaled content
    // (modals, popups) rendered outside the app's <main> still resolves --font-geist-sans.
    <Html suppressHydrationWarning className={GeistSans.variable}>
      <Head>
        {/* MUI */}
        <DocumentHeadTags {...props} />

        {/* PWA */}
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="manifest" href="/manifest.json" crossOrigin="use-credentials" />
        <link rel="mask-icon" href="/safari-pinned-tab.svg" color={customColors.dark} />
        <meta name="msapplication-TileColor" content={customColors.dark} />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="theme-color" content={customColors.dark} />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

MyDocument.getInitialProps = async (ctx: DocumentContext) => {
  // @mui/material-nextjs@5.x bundles Next 14 types; cast to its DocumentContext to bridge to Next 15's structurally-equivalent type.
  const finalProps = await documentGetInitialProps(ctx as Parameters<typeof documentGetInitialProps>[0]);
  return finalProps;
};
