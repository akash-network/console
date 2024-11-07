"use client";
import React, { useState } from "react";
import { Alert, buttonVariants, Collapsible, CollapsibleContent, CollapsibleTrigger } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { NavArrowLeft } from "iconoir-react";
import Link from "next/link";

import { UrlService } from "@src/utils/urlUtils";
import { ExternalLink } from "../shared/ExternalLink";
import { LinkTo } from "../shared/LinkTo";
import { CreateWalletSection } from "./CreateWalletSection";

export const NoKeplrSection: React.FunctionComponent = () => {
  const [isCreateWalletOpen, setIsCreateWalletOpen] = useState(false);

  return (
    <div>
      <Link href={UrlService.getStartedWallet()} className={cn(buttonVariants({ variant: "text" }))}>
        <NavArrowLeft className="mr-2 text-sm" />
        Back
      </Link>
      <ul className="list-decimal space-y-2 py-4 pl-8">
        <li>
          Install <ExternalLink href="https://chrome.google.com/webstore/detail/keplr/dmkamcknogkgcdfhhbddcghachkejeap" text="Keplr" />
        </li>
        <Collapsible open={isCreateWalletOpen} onOpenChange={setIsCreateWalletOpen}>
          <li>
            Create a wallet using{" "}
            <CollapsibleTrigger asChild>
              <LinkTo onClick={() => setIsCreateWalletOpen(prev => !prev)}>Keplr</LinkTo>
            </CollapsibleTrigger>
          </li>

          <CollapsibleContent>
            <Alert className="my-4">
              <CreateWalletSection />
            </Alert>
          </CollapsibleContent>
        </Collapsible>
        <li>Use a decentralized or centralized exchange to purchase USDC</li>

        <li>
          Use <ExternalLink href="https://chrome.google.com/webstore/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn" text="MetaMask" /> wallet to import USDC
          to <ExternalLink href="https://app.osmosis.zone/assets" text="Osmosis" />
        </li>

        <li>
          Swap <ExternalLink href="https://app.osmosis.zone/?from=USDC&to=AKT" text="USDC to AKT" />
        </li>

        <li>
          <ExternalLink href="https://app.osmosis.zone/assets" text="Withdraw" /> AKT to Keplr
        </li>
        <li>Done!</li>
      </ul>
    </div>
  );
};
