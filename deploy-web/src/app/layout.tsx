import type { Metadata, Viewport } from "next";
import "./globals.css";
import "../styles/index.css";
import { cookies } from "next/headers";
import GoogleAnalytics from "@src/components/layout/CustomGoogleAnalytics";
import localFont from "next/font/local";
import { customColors } from "@src/utils/colors";
import { cn } from "@src/utils/styleUtils";
import Providers from "@src/components/layout/CustomProviders";
import { Toaster } from "@src/components/ui/toaster";
import { AppLayoutContainer } from "@src/components/layout/AppLayoutContainer";
import getConfig from "next/config";
import { Inter as FontSans } from "next/font/google";

const { publicRuntimeConfig } = getConfig();

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans"
});

// const satoshi = localFont({
//   src: [
//     {
//       path: "./fonts/Satoshi-Variable.woff",
//       weight: "400",
//       style: "normal"
//     },
//     {
//       path: "./fonts/Satoshi-Variable.woff2",
//       weight: "400",
//       style: "normal"
//     },
//     {
//       path: "./fonts/Satoshi-Variable.ttf",
//       weight: "400",
//       style: "normal"
//     }
//   ]
//   // variable: "--font-sans"
// });

export const metadata: Metadata = {
  title: "Akash Console",
  description: "Akash Console",
  metadataBase: new URL("https://console.akash.network"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://console.akash.network/",
    siteName: "Akash Console",
    description:
      "Akash Console is the #1 platform to deploy docker containers on the Akash Network, a decentralized super cloud compute marketplace. Explore, deploy and track all in one place!",
    images: [
      {
        url: "https://console.akash.network/akash-console.png",
        width: 1200,
        height: 630,
        alt: "Akash Console Cover Image"
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
  const version = publicRuntimeConfig?.version;

  return (
    <html lang="en" className={theme} style={{ colorScheme: theme }} suppressHydrationWarning>
      <GoogleAnalytics />

      <body className={cn("bg-background tracking-wide antialiased", fontSans.variable)}>
        <Providers version={version}>
          <Toaster />

          <AppLayoutContainer version={version}>{children}</AppLayoutContainer>
        </Providers>
      </body>
    </html>
  );
}
