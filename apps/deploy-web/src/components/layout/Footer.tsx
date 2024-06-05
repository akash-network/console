import React from "react";
import { Copyright, Discord, Github, X as TwitterX, Youtube } from "iconoir-react";
import Link from "next/link";

import { UrlService } from "@src/utils/urlUtils";
import { Title } from "../shared/Title";

export interface IFooterProps {}

export const Footer: React.FunctionComponent<IFooterProps> = () => {
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
                className="block px-4 py-2 text-current transition-all duration-300 hover:text-primary [&>path]:fill-muted-foreground/20 hover:[&>path]:fill-primary"
              >
                <Discord className="mx-auto block h-6 w-6 text-5xl" />
              </a>
            </li>
            <li>
              <a
                href="https://twitter.com/akashnet_"
                target="_blank"
                rel="noreferrer"
                className="block px-4 py-2 text-current transition-all duration-300 hover:text-primary [&>path]:fill-muted-foreground/20 hover:[&>path]:fill-primary"
              >
                <TwitterX className="mx-auto block h-6 w-6 text-5xl" />
              </a>
            </li>
            <li>
              <a
                href="https://youtube.com/@AkashNetwork?si=cd2P3ZlAa4gNQw0X?sub_confirmation=1"
                target="_blank"
                rel="noreferrer"
                className="block px-4 py-2 text-current transition-all duration-300 hover:text-primary [&>path]:fill-muted-foreground/20 hover:[&>path]:fill-primary"
              >
                <Youtube className="mx-auto block h-6 w-6 text-5xl" />
              </a>
            </li>
            <li>
              <a
                href="https://github.com/akash-network/cloudmos"
                target="_blank"
                rel="noreferrer"
                className="block px-4 py-2 text-current transition-all duration-300 hover:text-primary [&>path]:fill-muted-foreground/20 hover:[&>path]:fill-primary"
              >
                <Github className="mx-auto block h-6 w-6 text-5xl" />
              </a>
            </li>
          </ul>

          <div className="mb-4 mt-2 flex items-center sm:mb-0 sm:mt-0">
            <Link href={UrlService.termsOfService()} className="text-current">
              <p className="text-sm text-muted-foreground">Terms of Service</p>
            </Link>

            <div className="ml-4">
              <Link href={UrlService.privacyPolicy()} className="text-current">
                <p className="text-sm text-muted-foreground">Privacy Policy</p>
              </Link>
            </div>

            <div className="ml-4">
              <Link href={UrlService.faq()} className="text-current">
                <p className="text-sm text-muted-foreground">FAQ</p>
              </Link>
            </div>

            <div className="ml-4">
              <Link href={UrlService.contact()} className="text-current">
                <p className="text-sm text-muted-foreground">Contact</p>
              </Link>
            </div>
          </div>

          <p className="flex items-center text-balance text-center text-sm leading-loose text-muted-foreground md:text-left">
            <Copyright className="text-xs" />
            &nbsp;Akash Network {year}
          </p>
        </div>
      </footer>
    </div>
  );
};
