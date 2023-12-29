import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Nav } from "@/components/layout/Nav";
import Providers from "@/components/layout/CustomProviders";
import { Toaster } from "@/components/ui/toaster";
import { cookies } from "next/headers";
import { customColors } from "@/lib/colors copy";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans"
});

export const metadata: Metadata = {
  title: "Akash Network Stats",
  description: "Akash Network Stats",
  metadataBase: new URL("https://stats.akash.network"),
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
      <body className={cn("min-h-screen bg-background font-sans antialiased", inter.variable)}>
        <Providers>
          <Nav />
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
