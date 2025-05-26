import "@akashnetwork/ui/styles";
import "nprogress/nprogress.css";
import "../styles/index.css";

import React, { useEffect, useState } from "react";
import { TooltipProvider } from "@akashnetwork/ui/components";
import { CustomSnackbarProvider, PopupProvider } from "@akashnetwork/ui/context";
import { cn } from "@akashnetwork/ui/utils";
import { AppCacheProvider } from "@mui/material-nextjs/v14-pagesRouter";
import { dehydrate, HydrationBoundary, QueryClientProvider } from "@tanstack/react-query";
import { GeistSans } from "geist/font/sans";
import { Provider as JotaiProvider } from "jotai";
import type { AppProps } from "next/app";
import Router from "next/router";
import type { NextSeoProps } from "next-seo/lib/types";
import { ThemeProvider } from "next-themes";
import NProgress from "nprogress";

import GoogleAnalytics from "@src/components/layout/CustomGoogleAnalytics";
import { CustomIntlProvider } from "@src/components/layout/CustomIntlProvider";
import { PageHead } from "@src/components/layout/PageHead";
import { ClientOnlyTurnstile } from "@src/components/turnstile/Turnstile";
import { UserProviders } from "@src/components/user/UserProviders";
import type { BrowserEnvConfig } from "@src/config/browser-env.config";
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
import { getServerSidePropsWithServices } from "@src/lib/nextjs/getServerSidePropsWithServices";
import { queryClient } from "@src/queries";
import { prefetchFeatureFlags } from "@src/queries/featureFlags";
import { serverApiUrlService } from "@src/services/api-url/server-api-url.service";
import { decodeInjectedConfig, hasInjectedConfig } from "@src/services/decodeInjectedConfig/decodeInjectedConfig";
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
  const [isResolvedConfig, setIsResolvedConfig] = useState(false);
  const [config, setConfig] = useState<Partial<BrowserEnvConfig> | null>(null);

  useEffect(() => {
    if (hasInjectedConfig()) {
      decodeInjectedConfig()
        .then(setConfig)
        .finally(() => setIsResolvedConfig(true));
    }
  }, []);

  if (hasInjectedConfig() && !isResolvedConfig) {
    return null;
  }

  return (
    <FlagProvider>
      <ClientOnlyTurnstile
        enabled={config?.NEXT_PUBLIC_TURNSTILE_ENABLED || browserEnvConfig.NEXT_PUBLIC_TURNSTILE_ENABLED}
        siteKey={config?.NEXT_PUBLIC_TURNSTILE_SITE_KEY || browserEnvConfig.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
      />
      <main className={cn("h-full bg-background font-sans tracking-wide antialiased", GeistSans.variable)}>
        <PageHead pageSeo={pageProps.seo} />

        <AppCacheProvider {...props}>
          <CustomIntlProvider>
            <QueryClientProvider client={queryClient}>
              <HydrationBoundary state={pageProps.dehydratedState}>
                <JotaiProvider store={store}>
                  <ThemeProvider attribute="class" defaultTheme="system" storageKey="theme" enableSystem disableTransitionOnChange>
                    <ColorModeProvider>
                      <CustomSnackbarProvider>
                        <GoogleAnalytics />
                        <UserProviders>
                          <PricingProvider>
                            <TooltipProvider>
                              <SettingsProvider>
                                <ServicesProvider>
                                  <CustomChainProvider>
                                    <PopupProvider>
                                      <WalletProvider>
                                        <ChainParamProvider>
                                          <CertificateProvider>
                                            <BackgroundTaskProvider>
                                              <LocalNoteProvider>
                                                <Component {...pageProps} />
                                              </LocalNoteProvider>
                                            </BackgroundTaskProvider>
                                          </CertificateProvider>
                                        </ChainParamProvider>
                                      </WalletProvider>
                                    </PopupProvider>
                                  </CustomChainProvider>
                                </ServicesProvider>
                              </SettingsProvider>
                            </TooltipProvider>
                          </PricingProvider>
                        </UserProviders>
                      </CustomSnackbarProvider>
                    </ColorModeProvider>
                  </ThemeProvider>
                </JotaiProvider>
              </HydrationBoundary>
            </QueryClientProvider>
          </CustomIntlProvider>
        </AppCacheProvider>
      </main>
    </FlagProvider>
  );
};

export default App;

export const getServerSideProps = getServerSidePropsWithServices(async ({ services }) => {
  try {
    await prefetchFeatureFlags(queryClient, services.axios, serverApiUrlService);
  } catch (error) {
    console.error(error);
  }

  return {
    props: {
      dehydratedState: dehydrate(queryClient)
    }
  };
});
