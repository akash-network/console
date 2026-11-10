"use client";
import { DiscordLogo, GithubLogo, XLogo } from "@akashnetwork/ui/components";

import { Link } from "@/components/Link/Link";

const SOCIAL_LINKS = [
  { label: "X", href: "https://twitter.com/akashnet", Logo: XLogo },
  { label: "GitHub", href: "https://github.com/akash-network/console", Logo: GithubLogo },
  { label: "Discord", href: "https://discord.akash.network", Logo: DiscordLogo }
];

export function SocialLinks() {
  return (
    <div className="flex items-center gap-1">
      {SOCIAL_LINKS.map(({ label, href, Logo }) => (
        <Link
          key={label}
          target="_blank"
          rel="noreferrer"
          href={href}
          aria-label={label}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-nested hover:text-foreground"
        >
          <Logo width="1rem" height="1rem" />
        </Link>
      ))}
    </div>
  );
}
