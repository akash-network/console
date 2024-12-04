import "@akashnetwork/ui/styles";
import "../config/logger.config";
import "../styles/index.css";

import { cn } from "@akashnetwork/ui/utils";
import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";
import getConfig from "next/config";
import { cookies } from "next/headers";

import GoogleAnalytics from "@/components/layout/CustomGoogleAnalytics";
import Providers from "@/components/layout/CustomProviders";
import { Footer } from "@/components/layout/Footer";
import { Nav } from "@/components/layout/Nav";
import { customColors } from "@/lib/colors";

const { publicRuntimeConfig } = getConfig();

export const metadata: Metadata = {
  title: "Akash Network Stats",
  description: "Akash Network Stats",
  metadataBase: new URL("https://stats.akash.network"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://stats.akash.network/",
    siteName: "Akash Stats",
    description: "Akash Network Analytics. The #1 decentralized supercloud.",
    images: [
      {
        url: "https://stats.akash.network/akash-stats.png",
        width: 1200,
        height: 630,
        alt: "Akash Stats Cover Image"
      }
    ]
  },
  twitter: {
    site: "@akashnet_",
    card: "summary_large_image"
  },
  icons: [
    {
      url: "/favicon.ico",
      href: "/favicon.ico",
      rel: "shortcut icon"
    },
    {
      sizes: "16x16",
      url: "/favicon-16x16.png",
      href: "/favicon-16x16.png",
      rel: "icon",
      type: "image/png"
    },
    {
      sizes: "32x32",
      url: "/favicon-32x32.png",
      href: "/favicon-32x32.png",
      rel: "icon",
      type: "image/png"
    },
    {
      url: "/safari-pinned-tab.svg",
      href: "/safari-pinned-tab.svg",
      rel: "mask-icon",
      color: customColors.dark
    },
    {
      url: "/apple-touch-icon.png",
      href: "/apple-touch-icon.png",
      rel: "apple-touch-icon"
    }
  ]
};

export const viewport: Viewport = {
  minimumScale: 1,
  initialScale: 1,
  width: "device-width"
};

/**
 * Get the theme from the cookie
 * next-themes doesn't support SSR
 * https://github.com/pacocoursey/next-themes/issues/169
 */
function getTheme() {
  const cookieStore = cookies();
  const themeCookie = cookieStore.get("theme");
  const theme = themeCookie ? themeCookie.value : "system";
  return theme;
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = getTheme() as string;
  const version = publicRuntimeConfig?.version;

  return (
    <html lang="en" className={theme} style={{ colorScheme: theme }} suppressHydrationWarning>
      <GoogleAnalytics />

      <body className={cn("min-h-screen bg-background font-sans tracking-wide antialiased", GeistSans.variable)}>
        <Providers>
          <Nav />
          <div className="flex min-h-[calc(100vh-60px)] flex-col justify-between">
            {children}
            <Footer version={version} />
          </div>
        </Providers>
      </body>
    </html>
  );
}
