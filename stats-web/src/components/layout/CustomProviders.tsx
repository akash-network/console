"use client";
import React from "react";
import { CustomIntlProvider } from "./CustomIntlProvider";
import { QueryClientProvider } from "react-query";
import { queryClient } from "@/queries";
import { Provider } from "jotai";
import { ThemeProvider } from "next-themes";
import { PricingProvider } from "@/context/PricingProvider";
import { TooltipProvider } from "../ui/tooltip";
import { AppProgressBar as ProgressBar } from "next-nprogress-bar";
import { customColors } from "@/lib/colors copy";

function Providers({ children }: React.PropsWithChildren) {
  return (
    <CustomIntlProvider>
      <QueryClientProvider client={queryClient}>
        <Provider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <PricingProvider>
              <TooltipProvider>
                <ProgressBar height="4px" color={customColors.akashRed} options={{ showSpinner: false }} shallowRouting />

                {children}
              </TooltipProvider>
            </PricingProvider>
          </ThemeProvider>
        </Provider>
      </QueryClientProvider>
    </CustomIntlProvider>
  );
}

export default Providers;
