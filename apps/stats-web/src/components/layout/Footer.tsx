"use client";
import { ArrowUpRight } from "lucide-react";
import dynamic from "next/dynamic";

import { ModeToggle } from "../ModeToggle";
import { SocialLinks } from "./SocialLinks";

import { Link } from "@/components/Link/Link";
import { ApiUrlService } from "@/lib/apiUtils";

const NetworkSelect = dynamic(() => import("./NetworkSelect"), {
  ssr: false
});

export function Footer({ version }: { version: string }) {
  const year = new Date().getFullYear();
  const apiHost = hostOf(ApiUrlService.baseApiUrl);

  return (
    <footer className="mx-auto w-full max-w-page px-4 pb-7 pt-5 sm:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-1.5 font-mono text-[10px] uppercase leading-relaxed tracking-[0.1em] text-faint">
          <span>Akash Network · The open compute marketplace · © {year}</span>
          <span className="tracking-[0.06em]">
            {apiHost ? `Data: ${apiHost}` : "Data: Akash Console API"} · v{version}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <NetworkSelect className="h-8 min-w-[160px] font-mono text-xs" />
          <ModeToggle />
          <SocialLinks />
          <Link
            href="https://console.akash.network"
            target="_blank"
            rel="noreferrer"
            className="flex h-8 items-center gap-1 rounded-md border px-3 text-xs font-medium text-foreground transition-colors hover:border-border-strong hover:bg-nested hover:text-foreground hover:no-underline"
          >
            Deploy on Akash
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </footer>
  );
}

function hostOf(url: string | undefined) {
  try {
    return url ? new URL(url).host : undefined;
  } catch {
    return undefined;
  }
}
