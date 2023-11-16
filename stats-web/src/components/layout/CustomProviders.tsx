"use client";

import React from "react";
import { CustomIntlProvider } from "./CustomIntlProvider";
import { QueryClientProvider } from "react-query";
import { queryClient } from "@/queries";
import { Provider } from "jotai";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@radix-ui/react-tooltip";

function Providers({ children }: React.PropsWithChildren) {
  return (
    <CustomIntlProvider>
      <QueryClientProvider client={queryClient}>
        <Provider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <TooltipProvider>{children}</TooltipProvider>
          </ThemeProvider>
        </Provider>
      </QueryClientProvider>
    </CustomIntlProvider>
  );
}

export default Providers;
