"use client";
import React from "react";
import { buttonVariants } from "@akashnetwork/ui/components";
import { NavArrowLeft } from "iconoir-react";
import Link from "next/link";

import { cn } from "@src/utils/styleUtils";
import { UrlService } from "@src/utils/urlUtils";
import { ExternalLink } from "../shared/ExternalLink";

export const WithKeplrSection: React.FunctionComponent = () => {
  return (
    <div>
      <Link href={UrlService.getStartedWallet()} className={cn(buttonVariants({ variant: "text" }))}>
        <NavArrowLeft className="mr-2 text-sm" />
        Back
      </Link>
      <ul className="list-decimal space-y-2 py-4 pl-8">
        <li>
          Swap <ExternalLink href="https://app.osmosis.zone/?from=USDC&to=AKT" text="some tokens to AKT" />
        </li>

        <li>
          <ExternalLink href="https://app.osmosis.zone/assets" text="Withdraw" /> AKT to Keplr
        </li>
        <li>Done!</li>
      </ul>
    </div>
  );
};
