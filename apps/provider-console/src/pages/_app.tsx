import "@akashnetwork/ui/styles";
import "../styles/index.css";

import { QueryClientProvider } from "react-query";
import { TooltipProvider } from "@akashnetwork/ui/components";
import { GeistSans } from "geist/font/sans";
import { Provider } from "jotai";
import type { AppProps } from "next/app";
import { ThemeProvider } from "next-themes";

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
            <ColorModeProvider>
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
