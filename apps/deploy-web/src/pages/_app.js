"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("@akashnetwork/ui/styles");
require("nprogress/nprogress.css");
require("../styles/index.css");
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var context_1 = require("@akashnetwork/ui/context");
var utils_1 = require("@akashnetwork/ui/utils");
var v14_pagesRouter_1 = require("@mui/material-nextjs/v14-pagesRouter");
var react_query_1 = require("@tanstack/react-query");
var sans_1 = require("geist/font/sans");
var jotai_1 = require("jotai");
var router_1 = require("next/router");
var next_navigation_guard_1 = require("next-navigation-guard");
var next_themes_1 = require("next-themes");
var nprogress_1 = require("nprogress");
var CustomGoogleAnalytics_1 = require("@src/components/layout/CustomGoogleAnalytics");
var CustomIntlProvider_1 = require("@src/components/layout/CustomIntlProvider");
var Layout_1 = require("@src/components/layout/Layout");
var PageHead_1 = require("@src/components/layout/PageHead");
var Turnstile_1 = require("@src/components/turnstile/Turnstile");
var UserProviders_1 = require("@src/components/user/UserProviders/UserProviders");
var browser_env_config_1 = require("@src/config/browser-env.config");
var CertificateProvider_1 = require("@src/context/CertificateProvider");
var ChainParamProvider_1 = require("@src/context/ChainParamProvider");
var CustomChainProvider_1 = require("@src/context/CustomChainProvider");
var CustomThemeContext_1 = require("@src/context/CustomThemeContext");
var FlagProvider_1 = require("@src/context/FlagProvider/FlagProvider");
var LocalNoteProvider_1 = require("@src/context/LocalNoteProvider");
var PaymentPollingProvider_1 = require("@src/context/PaymentPollingProvider");
var PricingProvider_1 = require("@src/context/PricingProvider/PricingProvider");
var ServicesProvider_1 = require("@src/context/ServicesProvider");
var RootContainerProvider_1 = require("@src/context/ServicesProvider/RootContainerProvider");
var SettingsProvider_1 = require("@src/context/SettingsProvider");
var WalletProvider_1 = require("@src/context/WalletProvider");
var useInjectedConfig_1 = require("@src/hooks/useInjectedConfig");
var global_store_1 = require("@src/store/global-store");
nprogress_1.default.configure({
    minimum: 0.2
});
//Binding events.
router_1.default.events.on("routeChangeStart", function () { return nprogress_1.default.start(); });
router_1.default.events.on("routeChangeComplete", function () { return nprogress_1.default.done(); });
router_1.default.events.on("routeChangeError", function () { return nprogress_1.default.done(); });
var App = function (props) {
    var Component = props.Component, pageProps = props.pageProps;
    var _a = (0, useInjectedConfig_1.useInjectedConfig)(), config = _a.config, isLoadedInjectedConfig = _a.isLoaded;
    if (!isLoadedInjectedConfig) {
        return (<AppRoot {...props}>
        <Layout_1.Loading text="Loading settings..."/>
      </AppRoot>);
    }
    return (<AppRoot {...props}>
      <>
        <Turnstile_1.ClientOnlyTurnstile enabled={(config === null || config === void 0 ? void 0 : config.NEXT_PUBLIC_TURNSTILE_ENABLED) || browser_env_config_1.browserEnvConfig.NEXT_PUBLIC_TURNSTILE_ENABLED} siteKey={(config === null || config === void 0 ? void 0 : config.NEXT_PUBLIC_TURNSTILE_SITE_KEY) || browser_env_config_1.browserEnvConfig.NEXT_PUBLIC_TURNSTILE_SITE_KEY}/>

        <CustomGoogleAnalytics_1.default />

        <UserProviders_1.UserProviders>
          <FlagProvider_1.FlagProvider>
            <WalletProvider_1.WalletProvider>
              <PaymentPollingProvider_1.PaymentPollingProvider>
                <CertificateProvider_1.CertificateProvider>
                  <next_navigation_guard_1.NavigationGuardProvider>
                    <Component {...pageProps}/>
                  </next_navigation_guard_1.NavigationGuardProvider>
                </CertificateProvider_1.CertificateProvider>
              </PaymentPollingProvider_1.PaymentPollingProvider>
            </WalletProvider_1.WalletProvider>
          </FlagProvider_1.FlagProvider>
        </UserProviders_1.UserProviders>
      </>
    </AppRoot>);
};
exports.default = App;
function AppRoot(props) {
    var queryClient = (0, RootContainerProvider_1.useRootContainer)().queryClient;
    return (<main className={(0, utils_1.cn)("h-full bg-background font-sans tracking-wide antialiased", sans_1.GeistSans.variable)}>
      <PageHead_1.PageHead pageSeo={props.pageProps.seo}/>

      <RootContainerProvider_1.RootContainerProvider>
        <v14_pagesRouter_1.AppCacheProvider {...props}>
          <CustomIntlProvider_1.CustomIntlProvider>
            <jotai_1.Provider store={global_store_1.store}>
              <react_query_1.QueryClientProvider client={queryClient}>
                <next_themes_1.ThemeProvider attribute="class" defaultTheme="system" storageKey="theme" enableSystem disableTransitionOnChange>
                  <CustomThemeContext_1.ColorModeProvider>
                    <context_1.CustomSnackbarProvider>
                      <components_1.TooltipProvider>
                        <context_1.PopupProvider>
                          <PricingProvider_1.PricingProvider>
                            <SettingsProvider_1.SettingsProvider>
                              <ServicesProvider_1.ServicesProvider>
                                <CustomChainProvider_1.CustomChainProvider>
                                  <ChainParamProvider_1.ChainParamProvider>
                                    <LocalNoteProvider_1.LocalNoteProvider>{props.children}</LocalNoteProvider_1.LocalNoteProvider>
                                  </ChainParamProvider_1.ChainParamProvider>
                                </CustomChainProvider_1.CustomChainProvider>
                              </ServicesProvider_1.ServicesProvider>
                            </SettingsProvider_1.SettingsProvider>
                          </PricingProvider_1.PricingProvider>
                        </context_1.PopupProvider>
                      </components_1.TooltipProvider>
                    </context_1.CustomSnackbarProvider>
                  </CustomThemeContext_1.ColorModeProvider>
                </next_themes_1.ThemeProvider>
              </react_query_1.QueryClientProvider>
            </jotai_1.Provider>
          </CustomIntlProvider_1.CustomIntlProvider>
        </v14_pagesRouter_1.AppCacheProvider>
      </RootContainerProvider_1.RootContainerProvider>
    </main>);
}
