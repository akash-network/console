import "@akashnetwork/ui/styles";
import "../styles/index.css";

import { GeistSans } from "geist/font/sans";
import type { AppProps } from "next/app";
import { ThemeProvider } from "next-themes";

import { ColorModeProvider } from "@src/context/CustomThemeContext";
import { cn } from "@src/utils/styleUtils";
import { Provider } from "jotai";
import { CustomChainProvider } from "@src/context/CustomChainProvider";
import { SettingsProvider } from "@src/context/SettingsProvider";
import { WalletProvider } from "@src/context/WalletProvider";
import { queryClient } from "@src/queries";
import { PricingProvider } from "@src/context/PricingProvider";
import { QueryClientProvider } from "react-query";
import { TooltipProvider } from "@akashnetwork/ui/components";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <main className={cn("bg-background h-full font-sans tracking-wide antialiased", GeistSans.variable)}>
      <QueryClientProvider client={queryClient}>
        <Provider>
          <ThemeProvider attribute="class" defaultTheme="system" storageKey="theme" enableSystem disableTransitionOnChange>
            <ColorModeProvider>
              <PricingProvider>
                <TooltipProvider>
                  <SettingsProvider>
                    <CustomChainProvider>
                      <WalletProvider>
                        <Component {...pageProps} />
                      </WalletProvider>
                    </CustomChainProvider>
                  </SettingsProvider>
                </TooltipProvider>
              </PricingProvider>
            </ColorModeProvider>
          </ThemeProvider>
        </Provider>
      </QueryClientProvider>
    </main>
  );
}
