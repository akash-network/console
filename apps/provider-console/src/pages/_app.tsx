import "@akashnetwork/ui/styles";
import "../styles/index.css";

import { Toaster, TooltipProvider } from "@akashnetwork/ui/components";
import { QueryClientProvider } from "@tanstack/react-query";
import { GeistSans } from "geist/font/sans";
import { Provider } from "jotai";
import type { AppProps } from "next/app";
import { ThemeProvider } from "next-themes";

import GoogleAnalytics from "@src/components/layout/CustomGoogleAnalytics";
import { ControlMachineProvider } from "@src/context/ControlMachineProvider";
import { CustomChainProvider } from "@src/context/CustomChainProvider";
import { ColorModeProvider } from "@src/context/CustomThemeContext";
import { PricingProvider } from "@src/context/PricingProvider";
import { ProviderContextProvider } from "@src/context/ProviderContext/ProviderContext";
import { WalletProvider } from "@src/context/WalletProvider";
import { queryClient } from "@src/queries";
import { cn } from "@src/utils/styleUtils";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <main className={cn("bg-background h-full font-sans tracking-wide antialiased", GeistSans.variable)}>
      <QueryClientProvider client={queryClient}>
        <Provider>
          <ThemeProvider attribute="class" defaultTheme="system" storageKey="theme" enableSystem disableTransitionOnChange>
            <Toaster />
            <ColorModeProvider>
              <GoogleAnalytics />
              <PricingProvider>
                <TooltipProvider>
                  <CustomChainProvider>
                    <WalletProvider>
                      <ControlMachineProvider>
                        <ProviderContextProvider>
                          <Component {...pageProps} />
                        </ProviderContextProvider>
                      </ControlMachineProvider>
                    </WalletProvider>
                  </CustomChainProvider>
                </TooltipProvider>
              </PricingProvider>
            </ColorModeProvider>
          </ThemeProvider>
        </Provider>
      </QueryClientProvider>
    </main>
  );
}
