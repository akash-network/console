import type { ReactNode } from "react";
import dynamic from "next/dynamic";

import { AkashConsoleLogo } from "@src/components/icons/AkashConsoleLogo";
import { REGION_MARKERS } from "./markers";

const Globe = dynamic(() => import("@src/components/globe/Globe/Globe").then(m => m.Globe), {
  ssr: false,
  loading: () => <div className="aspect-square w-full max-w-[600px] rounded-full bg-[hsl(var(--muted))] opacity-30" />
});

const DEPLOYMENT_GUIDE_URL = "https://akash.network/docs/getting-started/quick-start/";

export const DEPENDENCIES = {
  Globe,
  AkashConsoleLogo,
  REGION_MARKERS,
  DEPLOYMENT_GUIDE_URL
};

interface Props {
  children: ReactNode;
  topRightContent?: ReactNode;
  dependencies?: typeof DEPENDENCIES;
}

export function AuthLayout({ children, topRightContent, dependencies: d = DEPENDENCIES }: Props) {
  return (
    <div className="relative flex h-screen">
      <div className="dark relative hidden flex-col px-10 py-14 text-[hsl(var(--foreground))] lg:flex lg:w-1/2">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[#141414]" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.13]"
          style={{
            backgroundImage: "url('/images/auth-panel-noise.webp')",
            backgroundSize: "469.6px 469.6px",
            backgroundRepeat: "repeat",
            backgroundPosition: "top left"
          }}
        />

        <header className="relative flex items-center justify-between">
          <d.AkashConsoleLogo size={{ width: 305, height: 33 }} />
          {topRightContent}
        </header>

        <div className="relative flex flex-1 items-center justify-center py-8">
          <div className="aspect-square w-full max-w-[640px]">
            <d.Globe markers={d.REGION_MARKERS} surfaceTheme="dark" />
          </div>
        </div>

        <footer className="relative flex justify-end">
          <a
            href={d.DEPLOYMENT_GUIDE_URL}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          >
            Need Help? Read the full deployment guide ↗
          </a>
        </footer>
      </div>

      <div className="relative z-10 flex w-full flex-1 items-center justify-center overflow-y-auto bg-white px-3 py-4 lg:p-0 dark:bg-[#0a0a0a]">{children}</div>
    </div>
  );
}
