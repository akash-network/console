import React from "react";
import Router from "next/router";
import NProgress from "nprogress"; //nprogress module
import "nprogress/nprogress.css"; //styles of nprogress
import { AppCacheProvider } from "@mui/material-nextjs/v14-pagesRouter";
import { ColorModeProvider } from "@src/context/CustomThemeContext";
import { AppProps } from "next/app";
import withDarkMode from "next-dark-mode";
import "../styles/index.css";
import { isProd } from "@src/utils/constants";
import { GoogleAnalytics } from "nextjs-google-analytics";
import { PageHead } from "@src/components/layout/PageHead";

import "@interchain-ui/react/styles";

interface Props extends AppProps {}

NProgress.configure({
  minimum: 0.2
});

//Binding events.
Router.events.on("routeChangeStart", () => NProgress.start());
Router.events.on("routeChangeComplete", () => NProgress.done());
Router.events.on("routeChangeError", () => NProgress.done());

const App: React.FunctionComponent<Props> = props => {
  const { Component, pageProps } = props;

  return (
    <>
      <PageHead />
      <AppCacheProvider {...props}>
        <ColorModeProvider>
          {isProd && <GoogleAnalytics />}
          <Component {...pageProps} />
        </ColorModeProvider>
      </AppCacheProvider>
    </>
  );
};

export default withDarkMode(App);
