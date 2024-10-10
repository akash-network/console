import "nprogress/nprogress.css";
import "@akashnetwork/ui/styles";
import "../styles/index.css";

import React from "react";
import { QueryClientProvider } from "react-query";
import { TooltipProvider } from "@akashnetwork/ui/components";
import { CustomSnackbarProvider, PopupProvider } from "@akashnetwork/ui/context";
import { AppCacheProvider } from "@mui/material-nextjs/v14-pagesRouter";
import { GeistSans } from "geist/font/sans";
import { Provider as JotaiProvider } from "jotai";
import { AppProps } from "next/app";
import Router from "next/router";
import { ThemeProvider } from "next-themes";
import NProgress from "nprogress";

import GoogleAnalytics from "@src/components/layout/CustomGoogleAnalytics";
import { CustomIntlProvider } from "@src/components/layout/CustomIntlProvider";
import { PageHead } from "@src/components/layout/PageHead";
import { UserProviders } from "@src/components/user/UserProviders";
import { BackgroundTaskProvider } from "@src/context/BackgroundTaskProvider";
import { CertificateProvider } from "@src/context/CertificateProvider";
import { ChainParamProvider } from "@src/context/ChainParamProvider";
import { CustomChainProvider } from "@src/context/CustomChainProvider";
import { ColorModeProvider } from "@src/context/CustomThemeContext";
import { LocalNoteProvider } from "@src/context/LocalNoteProvider";
import { PricingProvider } from "@src/context/PricingProvider/PricingProvider";
import { SettingsProvider } from "@src/context/SettingsProvider";
import { TemplatesProvider } from "@src/context/TemplatesProvider";
import { WalletProvider } from "@src/context/WalletProvider";
import { queryClient } from "@src/queries";
import { store } from "@src/store/global-store";
import { cn } from "@src/utils/styleUtils";

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
            <JotaiProvider store={store}>
              <ThemeProvider attribute="class" defaultTheme="system" storageKey="theme" enableSystem disableTransitionOnChange>
                <ColorModeProvider>
                  <CustomSnackbarProvider>
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
                                        <TemplatesProvider>
                                          <LocalNoteProvider>
                                            <GoogleAnalytics />
                                            <Component {...pageProps} />
                                          </LocalNoteProvider>
                                        </TemplatesProvider>
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
  );
};

export default App;
