import type { AppProps } from "next/app";
import { ThemeProvider } from "next-themes";
import { GeistSans } from "geist/font/sans";

import "@akashnetwork/ui/styles";
import "../styles/index.css";
import { ColorModeProvider } from "@src/context/CustomThemeContext";
import { cn } from "@src/utils/styleUtils";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <main className={cn("bg-background h-full font-sans tracking-wide antialiased", GeistSans.variable)}>
      <ThemeProvider attribute="class" defaultTheme="system" storageKey="theme" enableSystem disableTransitionOnChange>
        <ColorModeProvider>
          <Component {...pageProps} />
        </ColorModeProvider>
      </ThemeProvider>
    </main>
  );
}

