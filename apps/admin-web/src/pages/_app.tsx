import "@akashnetwork/ui/styles";
import "../styles/index.css";

import { TooltipProvider } from "@akashnetwork/ui/components";
import { CustomSnackbarProvider } from "@akashnetwork/ui/context";
import { cn } from "@akashnetwork/ui/utils";
import { UserProvider } from "@auth0/nextjs-auth0/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GeistSans } from "geist/font/sans";
import type { AppProps } from "next/app";
import { ThemeProvider } from "next-themes";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false
    }
  }
});

export default function App({ Component, pageProps }: AppProps) {
  return (
    <main className={cn("bg-background h-full font-sans antialiased", GeistSans.variable)}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="system" storageKey="admin-theme" enableSystem disableTransitionOnChange>
          <CustomSnackbarProvider>
            <TooltipProvider>
              <UserProvider>
                <Component {...pageProps} />
              </UserProvider>
            </TooltipProvider>
          </CustomSnackbarProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </main>
  );
}
