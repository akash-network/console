import React, { useEffect } from "react";
import Router from "next/router";
import NProgress from "nprogress"; //nprogress module
import "nprogress/nprogress.css"; //styles of nprogress
import { CacheProvider, EmotionCache } from "@emotion/react";
import createEmotionCache from "@src/utils/createEmotionCache";
import { ColorModeProvider } from "@src/context/CustomThemeContext";
import { CustomSnackbarProvider } from "@src/context/CustomSnackbarProvider";
import { AppProps } from "next/app";
// import withDarkMode from "next-dark-mode";
import "../styles/index.css";
import { QueryClientProvider } from "react-query";
import { queryClient } from "@src/queries";
import { WalletProvider } from "@src/context/WalletProvider";
import { PricingProvider } from "@src/context/PricingProvider/PricingProvider";
import { BackgroundTaskProvider } from "@src/context/BackgroundTaskProvider";
import { SettingsProvider } from "@src/context/SettingsProvider";
import { CertificateProvider } from "@src/context/CertificateProvider";
import { TemplatesProvider } from "@src/context/TemplatesProvider";
import { LocalNoteProvider } from "@src/context/LocalNoteProvider";
import { isProd } from "@src/utils/constants";
import { GoogleAnalytics } from "nextjs-google-analytics";
import { UserProvider } from "@auth0/nextjs-auth0/client";
import { AddressBookProvider } from "@src/context/AddressBookProvider";
import { Provider } from "jotai";
import { usePreviousRoute } from "@src/hooks/usePreviousRoute";
import { PageHead } from "@src/components/layout/PageHead";
import { CustomChainProvider } from "@src/context/CustomChainProvider";

import "../styles/globals.css";
import "../styles/index.css";

import { ChainParamProvider } from "@src/context/ChainParamProvider";
import { CustomIntlProvider } from "@src/components/layout/CustomIntlProvider";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@src/components/ui/tooltip";
import { cn } from "@src/utils/styleUtils";
import { GeistSans } from "geist/font/sans";

interface Props extends AppProps {
  emotionCache?: EmotionCache;
}

NProgress.configure({
  minimum: 0.2
});

//Binding events.
Router.events.on("routeChangeStart", () => NProgress.start());
Router.events.on("routeChangeComplete", () => NProgress.done());
Router.events.on("routeChangeError", () => NProgress.done());

// Client-side cache, shared for the whole session of the user in the browser.
const clientSideEmotionCache = createEmotionCache();

const App: React.FunctionComponent<Props> = ({ Component, pageProps, emotionCache = clientSideEmotionCache }) => {
  usePreviousRoute();

  return (
    <main className={cn("h-full bg-background font-sans tracking-wide antialiased", GeistSans.variable)}>
      <PageHead />

      {/* <CacheProvider value={emotionCache}>
        <QueryClientProvider client={queryClient}>
          <Provider>
            <ColorModeProvider>
              <CustomSnackbarProvider>
                <PricingProvider>
                  <UserProvider>
                    <AddressBookProvider>
                      <SettingsProvider>
                        <CustomChainProvider>
                          <ChainParamProvider>
                            <WalletProvider>
                              <CertificateProvider>
                                <TemplatesProvider>
                                  <LocalNoteProvider>
                                    <BackgroundTaskProvider>
                                      {isProd && <GoogleAnalytics />}
                                      <Component {...pageProps} />
                                    </BackgroundTaskProvider>
                                  </LocalNoteProvider>
                                </TemplatesProvider>
                              </CertificateProvider>
                            </WalletProvider>
                          </ChainParamProvider>
                        </CustomChainProvider>
                      </SettingsProvider>
                    </AddressBookProvider>
                  </UserProvider>
                </PricingProvider>
              </CustomSnackbarProvider>
            </ColorModeProvider>
          </Provider>
        </QueryClientProvider>
      </CacheProvider> */}

      <CacheProvider value={emotionCache}>
        <CustomIntlProvider>
          <QueryClientProvider client={queryClient}>
            <Provider>
              {/* <StyledEngineProvider injectFirst> */}
              <ThemeProvider attribute="class" defaultTheme="light" storageKey="theme" enableSystem disableTransitionOnChange>
                <ColorModeProvider>
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
                                          {/* <ProgressBar height="4px" color={customColors.akashRed} options={{ showSpinner: false }} shallowRouting /> */}

                                          {isProd && <GoogleAnalytics />}
                                          <Component {...pageProps} />
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
                </ColorModeProvider>
              </ThemeProvider>
              {/* </StyledEngineProvider> */}
            </Provider>
          </QueryClientProvider>
        </CustomIntlProvider>
      </CacheProvider>
    </main>
  );
};

export default App;
