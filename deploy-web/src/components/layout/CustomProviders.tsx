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
import { CertificateProvider } from "@src/context/CertificateProvider";
import { LocalNoteProvider } from "@src/context/LocalNoteProvider";
import { TemplatesProvider } from "@src/context/TemplatesProvider";
import { StyledEngineProvider, createTheme, ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import { ChainParamProvider } from "@src/context/ChainParamProvider";

const theme = createTheme({
  palette: {
    primary: {
      main: "hsl(var(--primary))"
    }
  },
  components: {
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          backgroundColor: "hsl(var(--primary) / 15%)"
        }
      }
    }
  }
});

function Providers({ children, version }: React.PropsWithChildren<{ version: string }>) {
  //*              <PricingProvider>
  //*                <UserProvider>
  //                   <AddressBookProvider>
  //*                    <SettingsProvider>
  //*                      <CustomChainProvider>
  //*                        <WalletProvider>
  //*                          <CertificateProvider>
  //*                            <TemplatesProvider>
  //*                              <LocalNoteProvider>
  //                                 <BackgroundTaskProvider></BackgroundTaskProvider>
  return (
    <CustomIntlProvider>
      <QueryClientProvider client={queryClient}>
        <Provider>
          <StyledEngineProvider injectFirst>
            <MuiThemeProvider theme={theme}>
              <ThemeProvider attribute="class" defaultTheme="light" storageKey="theme" enableSystem disableTransitionOnChange>
                <PricingProvider>
                  <UserProvider>
                    {/* <AddressBookProvider> */}
                    <TooltipProvider>
                      <SettingsProvider version={version}>
                        <CustomChainProvider>
                          <WalletProvider>
                            <ChainParamProvider>
                              <CertificateProvider>
                                <TemplatesProvider>
                                  <LocalNoteProvider>
                                    <ProgressBar height="4px" color={customColors.akashRed} options={{ showSpinner: false }} shallowRouting />

                                    {children}
                                  </LocalNoteProvider>
                                </TemplatesProvider>
                              </CertificateProvider>
                            </ChainParamProvider>
                          </WalletProvider>
                        </CustomChainProvider>
                      </SettingsProvider>
                    </TooltipProvider>
                    {/* </AddressBookProvider> */}
                  </UserProvider>
                </PricingProvider>
              </ThemeProvider>
            </MuiThemeProvider>
          </StyledEngineProvider>
        </Provider>
      </QueryClientProvider>
    </CustomIntlProvider>
  );
}

export default Providers;
