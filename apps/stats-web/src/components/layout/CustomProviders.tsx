"use client";
import React, { useState } from "react";
import { TooltipProvider } from "@akashnetwork/ui/components";
import { CustomSnackbarProvider } from "@akashnetwork/ui/context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider } from "jotai";
import { AppProgressBar as ProgressBar } from "next-nprogress-bar";
import { ThemeProvider } from "next-themes";

import { CustomIntlProvider } from "./CustomIntlProvider";

import { FlagProvider } from "@/context/FlagProvider/FlagProvider";
import { PricingProvider } from "@/context/PricingProvider";
import { customColors } from "@/lib/colors";
import { store } from "@/store/global.store";

function Providers({ children }: React.PropsWithChildren) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <CustomIntlProvider>
      <QueryClientProvider client={queryClient}>
        <Provider store={store}>
          <ThemeProvider attribute="class" defaultTheme="system" storageKey="theme" enableSystem disableTransitionOnChange>
            <CustomSnackbarProvider>
              <PricingProvider>
                <TooltipProvider>
                  <ProgressBar height="4px" color={customColors.akashRed} options={{ showSpinner: false }} shallowRouting />
                  <FlagProvider>{children}</FlagProvider>
                </TooltipProvider>
              </PricingProvider>
            </CustomSnackbarProvider>
          </ThemeProvider>
        </Provider>
      </QueryClientProvider>
    </CustomIntlProvider>
  );
}

export default Providers;
