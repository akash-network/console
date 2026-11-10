"use client";
import { usePathname } from "next/navigation";

import { AkashLogo } from "../icons/AkashLogo";
import { isActiveNavLink, NAV_LINKS } from "./navLinks/navLinks";
import { LiveBlockHeight } from "./LiveBlockHeight";
import { MobileNav } from "./MobileNav";
import { TopBanner } from "./TopBanner";

import { Link } from "@/components/Link/Link";
import { SearchBar } from "@/components/SearchBar";
import { useTopBanner } from "@/hooks/useTopBanner";
import { cn } from "@/lib/utils";

export const Nav = () => {
  const { hasBanner } = useTopBanner();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/90 backdrop-blur-md">
      {hasBanner && <TopBanner />}

      <div className="mx-auto flex h-16 max-w-page items-center gap-[18px] px-4 sm:px-6">
        <Link href="/" className="flex flex-none items-center gap-3 text-foreground hover:text-foreground hover:no-underline">
          <AkashLogo className="h-[18px] w-auto" />
          <span className="rounded border px-[7px] py-1 font-mono text-[11px] font-medium leading-none tracking-[0.1em] text-muted-foreground">STATS</span>
        </Link>

        <nav aria-label="Main" className="hidden gap-1 text-[13px] font-medium lg:flex">
          {NAV_LINKS.map(link => {
            const isActive = isActiveNavLink(link, pathname);

            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "rounded-md px-2.5 py-[7px] transition-colors hover:no-underline",
                  isActive ? "bg-muted text-foreground hover:text-foreground" : "text-muted-foreground hover:bg-nested hover:text-foreground"
                )}
              >
                {link.title}
              </Link>
            );
          })}
        </nav>

        <div className="flex-1" />

        <SearchBar className="hidden w-[250px] min-w-[110px] shrink md:block" />
        <LiveBlockHeight className="hidden sm:flex" />

        <div className="lg:hidden">
          <MobileNav />
        </div>
      </div>
    </header>
  );
};
