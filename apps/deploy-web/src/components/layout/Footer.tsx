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
