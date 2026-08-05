"use client";
import type { ReactNode } from "react";
import { ThemeProvider } from "next-themes";

/**
 * next-themes injects an inline anti-FOUC script derived from these exact props, and deploy-web's CSP
 * allows it by sha256 (THEME_SCRIPT_HASH in lib/csp/csp.ts) since static Pages Router HTML cannot carry
 * a nonce. Keeping the provider here lets AppThemeProvider.spec.tsx render the production configuration
 * and fail when a next-themes upgrade or prop change alters the script without updating the hash.
 */
export const AppThemeProvider = ({ children }: { children: ReactNode }) => (
  <ThemeProvider attribute="class" defaultTheme="system" storageKey="theme" enableSystem disableTransitionOnChange>
    {children}
  </ThemeProvider>
);
