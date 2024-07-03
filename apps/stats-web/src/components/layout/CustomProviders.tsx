"use client";
import React from "react";
import { QueryClientProvider } from "react-query";
import { TooltipProvider } from "@akashnetwork/ui/components";
import { CustomSnackbarProvider } from "@akashnetwork/ui/context";
import { Provider } from "jotai";
import { AppProgressBar as ProgressBar } from "next-nprogress-bar";
import { ThemeProvider } from "next-themes";

import { CustomIntlProvider } from "./CustomIntlProvider";

import { PricingProvider } from "@/context/PricingProvider";
import { customColors } from "@/lib/colors";
import { queryClient } from "@/queries";

function Providers({ children }: React.PropsWithChildren) {
  return (
    <CustomIntlProvider>
      <QueryClientProvider client={queryClient}>
        <Provider>
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
