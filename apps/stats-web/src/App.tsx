import "nprogress/nprogress.css";

import { useEffect } from "react";
import { HelmetProvider } from "react-helmet-async";
import { Outlet, useNavigation } from "react-router-dom";
import { cn } from "@akashnetwork/ui/utils";
import NProgress from "nprogress";

import GoogleAnalytics from "./components/layout/CustomGoogleAnalytics";
import Providers from "./components/layout/CustomProviders";
import { Footer } from "./components/layout/Footer";
import { Nav } from "./components/layout/Nav";
import { useTheme } from "./hooks/useTheme";

// Configure NProgress
NProgress.configure({ showSpinner: false });

export function App() {
  const navigation = useNavigation();
  const { theme } = useTheme();

  // Show progress bar during navigation
  useEffect(() => {
    if (navigation.state === "loading") {
      NProgress.start();
    } else {
      NProgress.done();
    }
  }, [navigation.state]);

  return (
    <HelmetProvider>
      <div className={cn(theme, "min-h-screen bg-background font-sans tracking-wide antialiased")}>
        <Providers>
          <GoogleAnalytics />
          <Nav />
          <div className="flex min-h-[calc(100vh-60px)] flex-col justify-between">
            <Outlet />
            <Footer version={import.meta.env.VITE_APP_VERSION || "0.0.0"} />
          </div>
        </Providers>
      </div>
    </HelmetProvider>
  );
}
