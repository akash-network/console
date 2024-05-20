"use client";
import React, { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { UrlService } from "@src/utils/urlUtils";
import { ExternalLink } from "../shared/ExternalLink";
import { CreateWalletSection } from "./CreateWalletSection";
import { LinkTo } from "../shared/LinkTo";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { Alert } from "../ui/alert";
import { buttonVariants } from "../ui/button";
import { cn } from "@src/utils/styleUtils";
import { NavArrowLeft } from "iconoir-react";

type Props = {};

export const NoWalletSection: React.FunctionComponent<Props> = ({}) => {
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

        <li>
          Click "Buy tokens" at the bottom left corner of the screen to Purchasing USDC on <ExternalLink href="https://app.osmosis.zone/" text="Osmosis" /> with
          Kado
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
