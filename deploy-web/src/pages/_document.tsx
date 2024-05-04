import { Head, Main, NextScript, Html } from "next/document";
import React from "react";
import { customColors } from "@src/utils/colors";
import { DocumentHeadTags, documentGetInitialProps } from "@mui/material-nextjs/v14-pagesRouter";

export default function MyDocument(props) {
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
    </Html>
  );
}

MyDocument.getInitialProps = async ctx => {
  const finalProps = await documentGetInitialProps(ctx);
  return finalProps;
};
