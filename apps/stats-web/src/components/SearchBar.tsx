"use client";
import { useState } from "react";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";

import type { SearchTarget } from "@/lib/searchTarget/searchTarget";
import { toSearchTarget } from "@/lib/searchTarget/searchTarget";
import { UrlService } from "@/lib/urlUtils";
import { cn } from "@/lib/utils";

export function SearchBar({ className, onNavigate }: { className?: string; onNavigate?: () => void }) {
  const [searchTerms, setSearchTerms] = useState("");
  const [isInvalid, setIsInvalid] = useState(false);
  const router = useRouter();

  function navigateToSearchTarget(event: React.FormEvent) {
    event.preventDefault();

    if (!searchTerms.trim()) return;

    const target = toSearchTarget(searchTerms);

    if (!target) {
      setIsInvalid(true);
      return;
    }

    router.push(urlOf(target));
    setSearchTerms("");
    onNavigate?.();
  }

  return (
    <form role="search" onSubmit={navigateToSearchTarget} className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" aria-hidden />
      <input
        value={searchTerms}
        onChange={event => {
          setSearchTerms(event.target.value);
          setIsInvalid(false);
        }}
        onBlur={() => setIsInvalid(false)}
        aria-label="Search by block height, transaction hash or address"
        aria-invalid={isInvalid}
        placeholder="Search height / tx / address"
        className="h-9 w-full rounded-md border bg-card pl-8 pr-3 font-mono text-xs tracking-[0.02em] text-foreground outline-none transition-shadow placeholder:text-faint focus:border-akash focus:ring-[3px] focus:ring-akash/20"
      />
      {isInvalid && (
        <p
          role="alert"
          className="absolute left-0 top-full mt-2 w-full rounded-md border border-border-strong bg-popover px-3 py-2 text-xs text-muted-foreground shadow-lg"
        >
          No block height, transaction hash or Akash address matches this search.
        </p>
      )}
    </form>
  );
}

function urlOf(target: SearchTarget) {
  switch (target.type) {
    case "block":
      return UrlService.block(target.height);
    case "transaction":
      return UrlService.transaction(target.hash);
    case "address":
      return UrlService.address(target.address);
    case "validator":
      return UrlService.validator(target.address);
  }
}
