"use client";
import React from "react";
import { TooltipProvider } from "@akashnetwork/ui/components";
import { CustomSnackbarProvider } from "@akashnetwork/ui/context";
import { QueryClientProvider } from "@tanstack/react-query";
import { Provider } from "jotai";
import { AppProgressBar as ProgressBar } from "next-nprogress-bar";
import { ThemeProvider } from "next-themes";

import { CustomIntlProvider } from "./CustomIntlProvider";

import { PricingProvider } from "@/context/PricingProvider";
import { customColors } from "@/lib/colors";
import { queryClient } from "@/queries";
import { store } from "@/store/global.store";

function Providers({ children }: React.PropsWithChildren) {
  return (
    <CustomIntlProvider>
      <QueryClientProvider client={queryClient}>
        <Provider store={store}>
          <ThemeProvider attribute="class" defaultTheme="system" storageKey="theme" enableSystem disableTransitionOnChange>
            <CustomSnackbarProvider>
              <PricingProvider>
                <TooltipProvider>
                  <ProgressBar height="4px" color={customColors.akashRed} options={{ showSpinner: false }} shallowRouting />

                  {children}
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
