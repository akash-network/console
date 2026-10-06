import React from "react";
import { DiscordLogo, GithubLogo, XLogo, YoutubeLogo } from "@akashnetwork/ui/components";
import { Copyright } from "lucide-react";
import Link from "next/link";

import { UrlService } from "@src/utils/urlUtils";
import { Title } from "../shared/Title";

export type IFooterProps = Record<string, never>;

export const Footer: React.FC<IFooterProps> = () => {
  const year = new Date().getFullYear();

  return (
    <div className="mt-20 pb-12 text-center sm:text-left">
      <footer>
        <div className="mb-4 grid grid-cols-1 gap-4">
          <div>
            <Title subTitle className="mb-2 tracking-tight">
              Akash Console
            </Title>
            <p className="text-sm font-light">
              Akash Console is the #1 platform to deploy docker containers on the Akash Network, a decentralized cloud compute marketplace. Explore, deploy and
              track all in one place!
            </p>
          </div>
        </div>

        <div className="mb-4 flex h-20 flex-col items-center justify-between sm:mb-0 sm:flex-row">
          <ul className="flex items-center justify-center sm:justify-normal">
            <li>
              <a
                href="https://discord.gg/akash"
                target="_blank"
                rel="noreferrer"
                className="hover:text-primary [&>path]:fill-muted-foreground/20 hover:[&>path]:fill-primary block px-4 py-2 text-current transition-all duration-300"
              >
                <DiscordLogo className="mx-auto block h-6 w-6 text-5xl" />
              </a>
            </li>
            <li>
              <a
                href="https://twitter.com/akashnet"
                target="_blank"
                rel="noreferrer"
                className="hover:text-primary [&>path]:fill-muted-foreground/20 hover:[&>path]:fill-primary block px-4 py-2 text-current transition-all duration-300"
              >
                <XLogo className="mx-auto block h-6 w-6 text-5xl" />
              </a>
            </li>
            <li>
              <a
                href="https://youtube.com/@AkashNetwork?si=cd2P3ZlAa4gNQw0X?sub_confirmation=1"
                target="_blank"
                rel="noreferrer"
                className="hover:text-primary [&>path]:fill-muted-foreground/20 hover:[&>path]:fill-primary block px-4 py-2 text-current transition-all duration-300"
              >
                <YoutubeLogo className="mx-auto block h-6 w-6 text-5xl" />
              </a>
            </li>
            <li>
              <a
                href="https://github.com/akash-network/console"
                target="_blank"
                rel="noreferrer"
                className="hover:text-primary [&>path]:fill-muted-foreground/20 hover:[&>path]:fill-primary block px-4 py-2 text-current transition-all duration-300"
              >
                <GithubLogo className="mx-auto block h-6 w-6 text-5xl" />
              </a>
            </li>
          </ul>

          <div className="mb-4 mt-2 flex items-center sm:mb-0 sm:mt-0">
            <Link href={UrlService.termsOfService()} className="text-current">
              <p className="text-muted-foreground text-sm">Terms of Service</p>
            </Link>

            <div className="ml-4">
              <Link href={UrlService.privacyPolicy()} className="text-current">
                <p className="text-muted-foreground text-sm">Privacy Policy</p>
              </Link>
            </div>

            <div className="ml-4">
              <Link href="#" className="text-current">
                <p className="text-muted-foreground text-sm">FAQ</p>
              </Link>
            </div>

            <div className="ml-4">
              <Link href="#" className="text-current">
                <p className="text-muted-foreground text-sm">Contact</p>
              </Link>
            </div>
          </div>

          <p className="text-muted-foreground flex items-center text-balance text-center text-sm leading-loose md:text-left">
            <Copyright className="h-4 w-4" />
            &nbsp;Akash Network {year}
          </p>
        </div>
      </footer>
    </div>
  );
};
