import "@akashnetwork/ui/styles";
import "nprogress/nprogress.css";
import "../styles/index.css";

import React from "react";
import { TooltipProvider } from "@akashnetwork/ui/components";
import { CustomSnackbarProvider, PopupProvider } from "@akashnetwork/ui/context";
import { cn } from "@akashnetwork/ui/utils";
import { AppCacheProvider } from "@mui/material-nextjs/v14-pagesRouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { GeistSans } from "geist/font/sans";
import { Provider as JotaiProvider } from "jotai";
import type { AppProps } from "next/app";
import Router from "next/router";
import type { NextSeoProps } from "next-seo/lib/types";
import { ThemeProvider } from "next-themes";
import NProgress from "nprogress";

import GoogleAnalytics from "@src/components/layout/CustomGoogleAnalytics";
import { CustomIntlProvider } from "@src/components/layout/CustomIntlProvider";
import { Loading } from "@src/components/layout/Layout";
import { PageHead } from "@src/components/layout/PageHead";
import { ClientOnlyTurnstile } from "@src/components/turnstile/Turnstile";
import { UserProviders } from "@src/components/user/UserProviders";
import { browserEnvConfig } from "@src/config/browser-env.config";
import { BackgroundTaskProvider } from "@src/context/BackgroundTaskProvider";
import { CertificateProvider } from "@src/context/CertificateProvider";
import { ChainParamProvider } from "@src/context/ChainParamProvider";
import { CustomChainProvider } from "@src/context/CustomChainProvider";
import { ColorModeProvider } from "@src/context/CustomThemeContext";
import { FlagProvider } from "@src/context/FlagProvider/FlagProvider";
import { LocalNoteProvider } from "@src/context/LocalNoteProvider";
import { PricingProvider } from "@src/context/PricingProvider/PricingProvider";
import { ServicesProvider } from "@src/context/ServicesProvider";
import { SettingsProvider } from "@src/context/SettingsProvider";
import { WalletProvider } from "@src/context/WalletProvider";
import { useInjectedConfig } from "@src/hooks/useInjectedConfig";
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
  const { config, isLoaded: isLoadedInjectedConfig } = useInjectedConfig();

  if (!isLoadedInjectedConfig) {
    return (
      <AppRoot {...props}>
        <Loading text="Loading settings..." />
      </AppRoot>
    );
  }

  return (
    <AppRoot {...props}>
      <>
        <ClientOnlyTurnstile
          enabled={config?.NEXT_PUBLIC_TURNSTILE_ENABLED || browserEnvConfig.NEXT_PUBLIC_TURNSTILE_ENABLED}
          siteKey={config?.NEXT_PUBLIC_TURNSTILE_SITE_KEY || browserEnvConfig.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
        />

        <GoogleAnalytics />

        <UserProviders>
          <WalletProvider>
            <CertificateProvider>
              <BackgroundTaskProvider>
                <Component {...pageProps} />
              </BackgroundTaskProvider>
            </CertificateProvider>
          </WalletProvider>
        </UserProviders>
      </>
    </AppRoot>
  );
};

export default App;

function AppRoot(props: Props & { children: React.ReactNode }) {
  return (
    <FlagProvider>
      <main className={cn("h-full bg-background font-sans tracking-wide antialiased", GeistSans.variable)}>
        <PageHead pageSeo={props.pageProps.seo} />

        <AppCacheProvider {...props}>
          <CustomIntlProvider>
            <JotaiProvider store={store}>
              <QueryClientProvider client={queryClient}>
                <ThemeProvider attribute="class" defaultTheme="system" storageKey="theme" enableSystem disableTransitionOnChange>
                  <ColorModeProvider>
                    <CustomSnackbarProvider>
                      <TooltipProvider>
                        <PopupProvider>
                          <PricingProvider>
                            <SettingsProvider>
                              <ServicesProvider>
                                <CustomChainProvider>
                                  <ChainParamProvider>
                                    <LocalNoteProvider>{props.children}</LocalNoteProvider>
                                  </ChainParamProvider>
                                </CustomChainProvider>
                              </ServicesProvider>
                            </SettingsProvider>
                          </PricingProvider>
                        </PopupProvider>
                      </TooltipProvider>
                    </CustomSnackbarProvider>
                  </ColorModeProvider>
                </ThemeProvider>
              </QueryClientProvider>
            </JotaiProvider>
          </CustomIntlProvider>
        </AppCacheProvider>
      </main>
    </FlagProvider>
  );
}
