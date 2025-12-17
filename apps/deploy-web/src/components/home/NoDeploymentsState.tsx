"use client";
import React from "react";
import { Button, buttonVariants, Card, CardContent } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { MultiplePages, Rocket } from "iconoir-react";
import Link from "next/link";

import { ConnectWalletButton } from "@src/components/wallet/ConnectWalletButton";
import { useServices } from "@src/context/ServicesProvider";
import { UrlService } from "@src/utils/urlUtils";

type Props = {
  onDeployClick: () => void;
  hasDeployments?: boolean;
  isWalletConnected?: boolean;
  isSignedInWithTrial?: boolean;
  hasUser?: boolean;
  showTemplatesButton?: boolean;
};

export const NoDeploymentsState: React.FC<Props> = ({
  onDeployClick,
  hasDeployments = false,
  isWalletConnected = true,
  isSignedInWithTrial = false,
  hasUser = true,
  showTemplatesButton = true
}) => {
  const { urlService } = useServices();

  const title = hasDeployments ? "No active deployments." : "No deployments yet.";

  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <div className="mb-4 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg border">
          <Rocket className="rotate-45 text-muted-foreground" />
        </div>
        <h3 className="mb-2 text-xl font-bold">{title}</h3>

        {isSignedInWithTrial && !hasUser && (
          <p className="mb-4 text-center text-sm text-muted-foreground">If you are expecting to see some, you may need to sign-in or connect a wallet</p>
        )}

        {showTemplatesButton && (
          <p className="mb-6 text-center text-muted-foreground">
            Use one of our most popular templates below or create your first deployment using our SDL builder.
          </p>
        )}

        {isWalletConnected ? (
          <div className="flex gap-4">
            <Button onClick={onDeployClick} asChild>
              <Link href={urlService.newDeployment()}>
                <Rocket className="mr-2 h-4 w-4 rotate-45" />
                Create Deployment
              </Link>
            </Button>
            {showTemplatesButton && (
              <Button variant="outline" asChild>
                <Link href={urlService.templates()}>
                  <MultiplePages className="mr-2 h-4 w-4" />
                  Explore Templates
                </Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="mt-4 flex items-center justify-center gap-4">
            <ConnectWalletButton />
            <Link className={cn(buttonVariants({ variant: "outline" }))} href={UrlService.newLogin()} passHref prefetch={false}>
              Sign in
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
