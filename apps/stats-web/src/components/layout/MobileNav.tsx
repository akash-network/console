"use client";
import "react-modern-drawer/dist/index.css";

import { useState } from "react";
import Drawer from "react-modern-drawer";
import { ArrowUpRight, Menu } from "lucide-react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

import { AkashLogo } from "../icons/AkashLogo";
import { ModeToggle } from "../ModeToggle";
import { isActiveNavLink, NAV_LINKS } from "./navLinks/navLinks";
import { LiveBlockHeight } from "./LiveBlockHeight";
import { SocialLinks } from "./SocialLinks";

import { Link } from "@/components/Link/Link";
import { SearchBar } from "@/components/SearchBar";
import { cn } from "@/lib/utils";

const NetworkSelect = dynamic(() => import("./NetworkSelect"), {
  ssr: false
});

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const closeDrawer = () => setIsOpen(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(prevState => !prevState)}
        className="flex h-9 w-9 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-nested hover:text-foreground"
      >
        <Menu className="h-4 w-4" />
        <span className="sr-only">Toggle Menu</span>
      </button>

      <Drawer open={isOpen} onClose={closeDrawer} direction="left" size={300} className="!bg-background" customIdSuffix="mobile-drawer">
        <div className="flex h-full flex-col gap-5 overflow-y-auto border-r p-5">
          <div className="flex items-center gap-3">
            <AkashLogo className="h-[18px] w-auto text-foreground" />
            <span className="rounded border px-[7px] py-1 font-mono text-[11px] font-medium leading-none tracking-[0.1em] text-muted-foreground">STATS</span>
          </div>

          <SearchBar onNavigate={closeDrawer} />

          <nav aria-label="Mobile" className="flex flex-col gap-1 text-sm font-medium">
            {NAV_LINKS.map(link => {
              const isActive = isActiveNavLink(link, pathname);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={closeDrawer}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "rounded-md px-3 py-2 transition-colors hover:no-underline",
                    isActive ? "bg-muted text-foreground hover:text-foreground" : "text-muted-foreground hover:bg-nested hover:text-foreground"
                  )}
                >
                  {link.title}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto flex flex-col gap-3">
            <LiveBlockHeight className="self-start" />
            <NetworkSelect className="h-9 w-full max-w-none font-mono text-xs" />
            <div className="flex items-center justify-between">
              <SocialLinks />
              <ModeToggle />
            </div>
            <Link
              href="https://console.akash.network"
              target="_blank"
              rel="noreferrer"
              className="flex h-9 items-center justify-center gap-1 rounded-md border text-sm font-medium text-foreground hover:bg-nested hover:text-foreground hover:no-underline"
            >
              Deploy on Akash
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </Drawer>
    </>
  );
}
