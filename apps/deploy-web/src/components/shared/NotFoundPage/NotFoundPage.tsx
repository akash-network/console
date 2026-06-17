import React from "react";
import { buttonVariants, Card, CardContent } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { ArrowLeft, OpenInWindow } from "iconoir-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { NextSeo } from "next-seo";

import Layout from "@src/components/layout/Layout";
import { Title } from "@src/components/shared/Title";
import { useUser } from "@src/hooks/useUser";
import { UrlService } from "@src/utils/urlUtils";

export const CONSOLE_AIR_REPO_URL = "https://github.com/akash-network/console-air";

const REMOVED_SELF_CUSTODY_ROUTES = ["/get-started/wallet", "/mint-burn", "/settings/authorizations"];

const normalizePath = (path: string) => path.split("?")[0].split("#")[0].replace(/\/+$/, "") || "/";

export const DEPENDENCIES = {
  useRouter,
  useUser,
  Layout
};

type Props = {
  dependencies?: typeof DEPENDENCIES;
};

export const NotFoundPage: React.FunctionComponent<Props> = ({ dependencies: d = DEPENDENCIES }) => {
  const router = d.useRouter();
  const showSelfCustodyHint = REMOVED_SELF_CUSTODY_ROUTES.includes(normalizePath(router.asPath));
  const { user } = d.useUser();
  const isAuthenticated = !!user?.userId;

  return (
    <d.Layout>
      <NextSeo title="Page not found" />

      <div className="mt-10 text-center">
        <Title className="mb-2">404</Title>
        <h3 className="text-2xl">Page not found.</h3>

        {isAuthenticated && (
          <div className="pt-6">
            <Link href={UrlService.home()} className={cn(buttonVariants({ variant: "default" }), "inline-flex items-center")}>
              <ArrowLeft className="mr-4" />
              Go to homepage
            </Link>
          </div>
        )}

        {showSelfCustodyHint && (
          <Card className="mx-auto mt-10 max-w-xl text-left">
            <CardContent className="space-y-2 p-6">
              <p className="text-sm font-bold text-secondary-foreground">Looking for self-custody crypto features?</p>
              <p className="text-sm text-muted-foreground">
                Self-custody (Keplr/Leap connection, mint/burn, certificates, on-chain authorizations, and the liquidity modal) has moved to Console Air.
              </p>
              <Link
                href={CONSOLE_AIR_REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ variant: "outline" }), "inline-flex items-center")}
              >
                <OpenInWindow className="mr-2" />
                Open the Console Air repo
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </d.Layout>
  );
};
