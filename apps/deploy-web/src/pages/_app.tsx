import React from "react";
import { QueryClientProvider } from "react-query";
import { UserProvider } from "@auth0/nextjs-auth0/client";
import { AppCacheProvider } from "@mui/material-nextjs/v14-pagesRouter";
import { GeistSans } from "geist/font/sans";
import { Provider } from "jotai";
import { AppProps } from "next/app";
import Router from "next/router";
import { ThemeProvider } from "next-themes";
import NProgress from "nprogress"; //nprogress module

import GoogleAnalytics from "@src/components/layout/CustomGoogleAnalytics";
import { CustomIntlProvider } from "@src/components/layout/CustomIntlProvider";
import { PageHead } from "@src/components/layout/PageHead";
import { TooltipProvider } from "@src/components/ui/tooltip";
import { AddressBookProvider } from "@src/context/AddressBookProvider";
import { BackgroundTaskProvider } from "@src/context/BackgroundTaskProvider";
import { CertificateProvider } from "@src/context/CertificateProvider";
import { ChainParamProvider } from "@src/context/ChainParamProvider";
import { CustomChainProvider } from "@src/context/CustomChainProvider";
import { CustomSnackbarProvider } from "@src/context/CustomSnackbarProvider";
import { ColorModeProvider } from "@src/context/CustomThemeContext";
import { LocalNoteProvider } from "@src/context/LocalNoteProvider";
import { PopupProvider } from "@src/context/PopupProvider/PopupProvider";
import { PricingProvider } from "@src/context/PricingProvider/PricingProvider";
import { SettingsProvider } from "@src/context/SettingsProvider";
import { TemplatesProvider } from "@src/context/TemplatesProvider";
import { WalletProvider } from "@src/context/WalletProvider";
import { queryClient } from "@src/queries";
import { cn } from "@src/utils/styleUtils";

import "nprogress/nprogress.css"; //styles of nprogress
import "@akashnetwork/ui/styles";
import "../styles/index.css";
import "@leapwallet/elements/styles.css";

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
    <main className={cn("h-full bg-background font-sans tracking-wide antialiased", GeistSans.variable)}>
      <PageHead />

      <AppCacheProvider {...props}>
        <CustomIntlProvider>
          <QueryClientProvider client={queryClient}>
            <Provider>
              <ThemeProvider attribute="class" defaultTheme="system" storageKey="theme" enableSystem disableTransitionOnChange>
                <ColorModeProvider>
                  <CustomSnackbarProvider>
                    <PricingProvider>
                      <UserProvider>
                        <AddressBookProvider>
                          <TooltipProvider>
                            <SettingsProvider>
                              <CustomChainProvider>
                                <WalletProvider>
                                  <ChainParamProvider>
                                    <CertificateProvider>
                                      <BackgroundTaskProvider>
                                        <TemplatesProvider>
                                          <LocalNoteProvider>
                                            <GoogleAnalytics />
                                            <PopupProvider>
                                              <Component {...pageProps} />
                                            </PopupProvider>
                                          </LocalNoteProvider>
                                        </TemplatesProvider>
                                      </BackgroundTaskProvider>
                                    </CertificateProvider>
                                  </ChainParamProvider>
                                </WalletProvider>
                              </CustomChainProvider>
                            </SettingsProvider>
                          </TooltipProvider>
                        </AddressBookProvider>
                      </UserProvider>
                    </PricingProvider>
                  </CustomSnackbarProvider>
                </ColorModeProvider>
              </ThemeProvider>
            </Provider>
          </QueryClientProvider>
        </CustomIntlProvider>
      </AppCacheProvider>
    </main>
  );
};

export default App;
