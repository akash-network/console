import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cookies } from "next/headers";
// import { customColors } from "@/lib/colors";
import GoogleAnalytics from "@src/components/layout/CustomGoogleAnalytics";
import localFont from "next/font/local";
import { customColors } from "@src/utils/colors";
import { cn } from "@src/utils/styleUtils";
import Providers from "@src/components/layout/CustomProviders";
import { Toaster } from "@src/components/ui/toaster";
import { Nav } from "@src/components/layout/Nav";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorFallback } from "@src/components/shared/ErrorFallback";
import { AppLayoutContainer } from "@src/components/layout/AppLayoutContainer";

// const inter = Inter({
//   subsets: ["latin"],
//   variable: "--font-sans"
// });

const satoshi = localFont({
  src: [
    {
      path: "./fonts/Satoshi-Variable.woff",
      weight: "400",
      style: "normal"
    },
    {
      path: "./fonts/Satoshi-Variable.woff2",
      weight: "400",
      style: "normal"
    },
    {
      path: "./fonts/Satoshi-Variable.ttf",
      weight: "400",
      style: "normal"
    }
  ]
  // variable: "--font-sans"
});

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
  const theme = themeCookie ? themeCookie.value : "light";
  return theme;
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = getTheme() as string;

  return (
    <html lang="en" className={theme} style={{ colorScheme: theme }} suppressHydrationWarning>
      <GoogleAnalytics />

      <body className={cn("min-h-screen bg-background tracking-wide antialiased", satoshi.className)}>
        <Providers>
          <Toaster />

          <AppLayoutContainer>{children}</AppLayoutContainer>
        </Providers>
      </body>
    </html>
  );
}
