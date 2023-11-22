"use client";
import React from "react";
import { CustomIntlProvider } from "./CustomIntlProvider";
import { QueryClientProvider } from "react-query";
import { queryClient } from "@/queries";
import { Provider } from "jotai";
import { ThemeProvider } from "next-themes";
import { PricingProvider } from "@/context/PricingProvider";
import { TooltipProvider } from "../ui/tooltip";

function Providers({ children }: React.PropsWithChildren) {
  return (
    <CustomIntlProvider>
      <QueryClientProvider client={queryClient}>
        <Provider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <PricingProvider>
              <TooltipProvider>{children}</TooltipProvider>
            </PricingProvider>
          </ThemeProvider>
        </Provider>
      </QueryClientProvider>
    </CustomIntlProvider>
  );
}

export default Providers;
