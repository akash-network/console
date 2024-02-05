"use client";
import React from "react";
import { CustomIntlProvider } from "./CustomIntlProvider";
import { QueryClientProvider } from "react-query";
import { queryClient } from "@src/queries";
import { Provider } from "jotai";
import { ThemeProvider } from "next-themes";
import { PricingProvider } from "@src/context/PricingProvider";
import { TooltipProvider } from "../ui/tooltip";
import { AppProgressBar as ProgressBar } from "next-nprogress-bar";
import { customColors } from "@src/utils/colors";
import { SettingsProvider } from "@src/context/SettingsProvider";
import { CustomChainProvider } from "@src/context/CustomChainProvider";
import { UserProvider } from "@auth0/nextjs-auth0/client";
import { WalletProvider } from "@src/context/WalletProvider";
// import { AddressBookProvider } from "@src/context/AddressBookProvider";

import "@interchain-ui/react/styles";
import { CertificateProvider } from "@src/context/CertificateProvider";
import { LocalNoteProvider } from "@src/context/LocalNoteProvider";

function Providers({ children, version }: React.PropsWithChildren<{ version: string }>) {
  //*              <PricingProvider>
  //*                <UserProvider>
  //                   <AddressBookProvider>
  //*                    <SettingsProvider>
  //*                      <CustomChainProvider>
  //*                        <WalletProvider>
  //*                          <CertificateProvider>
  //                             <TemplatesProvider>
  //*                              <LocalNoteProvider>
  //                                 <BackgroundTaskProvider></BackgroundTaskProvider>
  return (
    <CustomIntlProvider>
      <QueryClientProvider client={queryClient}>
        <Provider>
          <ThemeProvider attribute="class" defaultTheme="light" storageKey="theme" enableSystem disableTransitionOnChange>
            <PricingProvider>
              <UserProvider>
                {/* <AddressBookProvider> */}
                <TooltipProvider>
                  <SettingsProvider version={version}>
                    <CustomChainProvider>
                      <WalletProvider>
                        <CertificateProvider>
                          <LocalNoteProvider>
                            <ProgressBar height="4px" color={customColors.akashRed} options={{ showSpinner: false }} shallowRouting />

                            {children}
                          </LocalNoteProvider>
                        </CertificateProvider>
                      </WalletProvider>
                    </CustomChainProvider>
                  </SettingsProvider>
                </TooltipProvider>
                {/* </AddressBookProvider> */}
              </UserProvider>
            </PricingProvider>
          </ThemeProvider>
        </Provider>
      </QueryClientProvider>
    </CustomIntlProvider>
  );
}

export default Providers;
