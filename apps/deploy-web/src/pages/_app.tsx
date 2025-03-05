import "nprogress/nprogress.css";
import "@akashnetwork/ui/styles";
import "../styles/index.css";

import React from "react";
import { QueryClientProvider } from "react-query";
import { TooltipProvider } from "@akashnetwork/ui/components";
import { CustomSnackbarProvider, PopupProvider } from "@akashnetwork/ui/context";
import { cn } from "@akashnetwork/ui/utils";
import { AppCacheProvider } from "@mui/material-nextjs/v14-pagesRouter";
import { GeistSans } from "geist/font/sans";
import { Provider as JotaiProvider } from "jotai";
import { AppProps } from "next/app";
import Router from "next/router";
import { NextSeoProps } from "next-seo/lib/types";
import { ThemeProvider } from "next-themes";
import NProgress from "nprogress";

import GoogleAnalytics from "@src/components/layout/CustomGoogleAnalytics";
import { CustomIntlProvider } from "@src/components/layout/CustomIntlProvider";
import { PageHead } from "@src/components/layout/PageHead";
import { ClientOnlyTurnstile } from "@src/components/turnstile/Turnstile";
import { UserProviders } from "@src/components/user/UserProviders";
import { BackgroundTaskProvider } from "@src/context/BackgroundTaskProvider";
import { CertificateProvider } from "@src/context/CertificateProvider";
import { ChainParamProvider } from "@src/context/ChainParamProvider";
import { CustomChainProvider } from "@src/context/CustomChainProvider";
import { ColorModeProvider } from "@src/context/CustomThemeContext";
import { LocalNoteProvider } from "@src/context/LocalNoteProvider";
import { PricingProvider } from "@src/context/PricingProvider/PricingProvider";
import { ServicesProvider } from "@src/context/ServicesProvider";
import { SettingsProvider } from "@src/context/SettingsProvider";
import { WalletProvider } from "@src/context/WalletProvider";
import { queryClient } from "@src/queries";
import { store } from "@src/store/global-store";

interface Props extends AppProps {
  seo?: NextSeoProps;
}

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
      <ClientOnlyTurnstile />
      <main className={cn("h-full bg-background font-sans tracking-wide antialiased", GeistSans.variable)}>
        <PageHead pageSeo={pageProps.seo} />

        <AppCacheProvider {...props}>
          <CustomIntlProvider>
            <QueryClientProvider client={queryClient}>
              <JotaiProvider store={store}>
                <ThemeProvider attribute="class" defaultTheme="system" storageKey="theme" enableSystem disableTransitionOnChange>
                  <ColorModeProvider>
                    <CustomSnackbarProvider>
                      <GoogleAnalytics />
                      <UserProviders>
                        <PricingProvider>
                          <TooltipProvider>
                            <SettingsProvider>
                              <CustomChainProvider>
                                <PopupProvider>
                                  <WalletProvider>
                                    <ChainParamProvider>
                                      <CertificateProvider>
                                        <BackgroundTaskProvider>
                                          <LocalNoteProvider>
                                            <ServicesProvider>
                                              <Component {...pageProps} />
                                            </ServicesProvider>
                                          </LocalNoteProvider>
                                        </BackgroundTaskProvider>
                                      </CertificateProvider>
                                    </ChainParamProvider>
                                  </WalletProvider>
                                </PopupProvider>
                              </CustomChainProvider>
                            </SettingsProvider>
                          </TooltipProvider>
                        </PricingProvider>
                      </UserProviders>
                    </CustomSnackbarProvider>
                  </ColorModeProvider>
                </ThemeProvider>
              </JotaiProvider>
            </QueryClientProvider>
          </CustomIntlProvider>
        </AppCacheProvider>
      </main>
    </>
  );
};

export default App;
