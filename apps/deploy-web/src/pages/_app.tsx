import "@akashnetwork/ui/styles";
import "nprogress/nprogress.css";
import "../styles/index.css";

import React from "react";
import { LoggerService } from "@akashnetwork/logging";
import { TooltipProvider } from "@akashnetwork/ui/components";
import { CustomSnackbarProvider, PopupProvider } from "@akashnetwork/ui/context";
import { cn } from "@akashnetwork/ui/utils";
import { AppCacheProvider } from "@mui/material-nextjs/v14-pagesRouter";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { Provider as JotaiProvider } from "jotai";
import type { AppProps } from "next/app";
import dynamic from "next/dynamic";
import Router from "next/router";
import { NavigationGuardProvider } from "next-navigation-guard";
import type { NextSeoProps } from "next-seo/lib/types";
import NProgress from "nprogress";

import { ActivityHost } from "@src/components/activity/ActivityHost/ActivityHost";
import { DeploymentReadyHost } from "@src/components/activity/DeploymentReadyHost/DeploymentReadyHost";
import { AccountCreatedTracker } from "@src/components/analytics/AccountCreatedTracker/AccountCreatedTracker";
import { AppBootstrap } from "@src/components/AppBootstrap/AppBootstrap";
import { AssistantHost } from "@src/components/assistant/AssistantHost/AssistantHost";
import { TOASTS_BESIDE_ASSISTANT_PANEL } from "@src/components/assistant/AssistantPanel/AssistantPanel";
import { RequireAuth } from "@src/components/auth/RequireAuth/RequireAuth";
import { AddCreditsHost } from "@src/components/billing-usage/AddCreditsHost/AddCreditsHost";
import { CloseDeploymentConfirmHost } from "@src/components/deployments/CloseDeploymentConfirmHost/CloseDeploymentConfirmHost";
import { DeploymentCopyCleanup } from "@src/components/deployments/DeploymentCopyCleanup/DeploymentCopyCleanup";
import { RequireFairUsePolicy } from "@src/components/fair-use-policy/RequireFairUsePolicy/RequireFairUsePolicy";
import { AppQueryClientProvider } from "@src/components/layout/AppQueryClientProvider/AppQueryClientProvider";
import { AppThemeProvider } from "@src/components/layout/AppThemeProvider";
import { CustomIntlProvider } from "@src/components/layout/CustomIntlProvider";
import { PageHead } from "@src/components/layout/PageHead";
import { SignedInHosts } from "@src/components/layout/SignedInHosts/SignedInHosts";
import { RequireOnboarding } from "@src/components/onboarding/RequireOnboarding/RequireOnboarding";
import { AccountDeletedNotice } from "@src/components/user/AccountDeletedNotice/AccountDeletedNotice";
import { UserProviders } from "@src/components/user/UserProviders/UserProviders";
import { WhatsNewHost } from "@src/components/whats-new/WhatsNewHost/WhatsNewHost";
import { BlockchainStatusProvider } from "@src/context/BlockchainStatusProvider";
import { BootLoadingProvider } from "@src/context/BootLoadingProvider/BootLoadingProvider";
import { ColorModeProvider } from "@src/context/CustomThemeContext";
import { FlagProvider, WaitForFeatureFlags } from "@src/context/FlagProvider/FlagProvider";
import { OrganizationProvider } from "@src/context/OrganizationProvider/OrganizationProvider";
import { PaymentPollingProvider } from "@src/context/PaymentPollingProvider";
import { ServicesProvider } from "@src/context/ServicesProvider";
import { RootContainerProvider } from "@src/context/ServicesProvider/RootContainerProvider";
import { WalletProvider } from "@src/context/WalletProvider";
import type { PageWithAuth } from "@src/lib/pages/definePublicPage";
import { readVisitorAccess } from "@src/lib/pages/visitorAccess/visitorAccess";
import { store } from "@src/store/global-store";
import { tolerateTranslatorDomEdits } from "@src/utils/tolerateTranslatorDomEdits/tolerateTranslatorDomEdits";

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

if (typeof window !== "undefined") {
  tolerateTranslatorDomEdits(Node.prototype, LoggerService.forContext("TranslatorDomGuard"));
}

const App: React.FunctionComponent<Props> = props => {
  const { Component, pageProps } = props;
  const visitorAccess = readVisitorAccess(pageProps);
  const isPublic = (Component as PageWithAuth).auth === "public" || !!visitorAccess;

  return (
    <AppRoot {...props}>
      <BootLoadingProvider>
        <UserProviders isRenderedForVisitor={!!visitorAccess}>
          <AccountCreatedTracker />
          <AccountDeletedNotice />
          <RequireAuth isPublic={isPublic}>
            <FlagProvider bootstrap={visitorAccess?.featureToggles}>
              <OrganizationProvider>
                <WalletProvider>
                  <PaymentPollingProvider>
                    <SignedInHosts isRenderedForVisitor={!!visitorAccess}>
                      <AddCreditsHost />
                      <DeploymentCopyCleanup />
                      <CloseDeploymentConfirmHost />
                      <ActivityHost />
                      <DeploymentReadyHost />
                      <WhatsNewHost />
                      <AssistantHost />
                    </SignedInHosts>
                    <NavigationGuardProvider>
                      <RequireOnboarding isPublic={isPublic}>
                        <WaitForFeatureFlags isBootstrapped={!!visitorAccess}>
                          <RequireFairUsePolicy isPublic={isPublic}>
                            <Component {...pageProps} />
                          </RequireFairUsePolicy>
                        </WaitForFeatureFlags>
                      </RequireOnboarding>
                    </NavigationGuardProvider>
                  </PaymentPollingProvider>
                </WalletProvider>
              </OrganizationProvider>
            </FlagProvider>
          </RequireAuth>
        </UserProviders>
      </BootLoadingProvider>
    </AppRoot>
  );
};

export default App;

const LocalNoteManager = dynamic(() => import("@src/components/LocalNoteManager/LocalNoteManager").then(mod => mod.LocalNoteManager), {
  ssr: false
});
function AppRoot(props: Props & { children: React.ReactNode }) {
  return (
    <main className={cn("h-full bg-background font-sans antialiased", GeistSans.variable, GeistMono.variable)}>
      <PageHead pageSeo={props.pageProps.seo} />

      <RootContainerProvider>
        <AppCacheProvider {...props}>
          <CustomIntlProvider>
            <JotaiProvider store={store}>
              <AppQueryClientProvider dehydratedState={props.pageProps.dehydratedState}>
                <AppThemeProvider>
                  <ColorModeProvider>
                    <CustomSnackbarProvider containerClassName={TOASTS_BESIDE_ASSISTANT_PANEL}>
                      <TooltipProvider>
                        <PopupProvider>
                          <BlockchainStatusProvider>
                            <ServicesProvider>
                              <AppBootstrap />
                              <LocalNoteManager />
                              {props.children}
                            </ServicesProvider>
                          </BlockchainStatusProvider>
                        </PopupProvider>
                      </TooltipProvider>
                    </CustomSnackbarProvider>
                  </ColorModeProvider>
                </AppThemeProvider>
              </AppQueryClientProvider>
            </JotaiProvider>
          </CustomIntlProvider>
        </AppCacheProvider>
      </RootContainerProvider>
    </main>
  );
}
