import type { AppProps } from "next/app";
import { ThemeProvider } from "next-themes";
import { GeistSans } from "geist/font/sans";

import "@akashnetwork/ui/styles";
import "../styles/index.css";
import { ColorModeProvider } from "@src/context/CustomThemeContext";
import { cn } from "@src/utils/styleUtils";
import { Provider } from "jotai";
import { CustomChainProvider } from "@src/context/CustomChainProvider";
import { SettingsProvider } from "@src/context/SettingsProvider";
import { WalletProvider } from "@src/context/WalletProvider";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <main className={cn("bg-background h-full font-sans tracking-wide antialiased", GeistSans.variable)}>
      <Provider>
        <ThemeProvider attribute="class" defaultTheme="system" storageKey="theme" enableSystem disableTransitionOnChange>
          <ColorModeProvider>
            <SettingsProvider>
              <CustomChainProvider>
                <WalletProvider>
                  <Component {...pageProps} />
                </WalletProvider>
              </CustomChainProvider>
            </SettingsProvider>
          </ColorModeProvider>
        </ThemeProvider>
      </Provider>
    </main>
  );
}
