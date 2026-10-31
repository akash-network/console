import React from "react";
import { isApiError } from "@akashnetwork/openapi-sdk";
import { Card, CardContent, LoadingButton } from "@akashnetwork/ui/components";
import { useRouter } from "next/router";
import { NextSeo } from "next-seo";

import Layout from "@src/components/layout/Layout";
import { Title } from "@src/components/shared/Title";
import { useServices } from "@src/context/ServicesProvider";
import { SKIP_REPORTING_REFUSED_INPUT } from "@src/services/query-error-policy/query-error-policy";

export const DEPENDENCIES = { useRouter, Layout };

type View = { name: "waiting-for-router" } | { name: "invalid-link" } | { name: "confirmed" } | { name: "confirm"; token: string };

function isRefusedLinkError(error: unknown): boolean {
  return isApiError(error) && error.status === 400;
}

function getView(isRouterReady: boolean, token: string | undefined, confirmation: { isSuccess: boolean; error: unknown }): View {
  if (!isRouterReady) return { name: "waiting-for-router" };
  if (!token || isRefusedLinkError(confirmation.error)) return { name: "invalid-link" };
  if (confirmation.isSuccess) return { name: "confirmed" };
  return { name: "confirm", token };
}

type Props = {
  dependencies?: typeof DEPENDENCIES;
};

export const NotificationAddressConfirmation: React.FunctionComponent<Props> = ({ dependencies: d = DEPENDENCIES }) => {
  const router = d.useRouter();
  const { api } = useServices();
  const confirmation = api.v1.createNotificationAddressConfirmation.useMutation({ meta: SKIP_REPORTING_REFUSED_INPUT });
  const view = getView(router.isReady, typeof router.query.token === "string" ? router.query.token : undefined, confirmation);

  return (
    <d.Layout>
      <NextSeo title="Confirm your email address" noindex nofollow />

      <Card className="mx-auto mt-10 max-w-xl">
        <CardContent className="space-y-4 p-6">
          {view.name === "invalid-link" && (
            <>
              <Title subTitle>This link doesn&apos;t work</Title>
              <p className="text-muted-foreground">
                The link was already used or a newer confirmation email replaced it. Open the latest confirmation email, or ask whoever added this address to
                send a new one.
              </p>
            </>
          )}
          {view.name === "confirmed" && (
            <>
              <Title subTitle>Email address confirmed</Title>
              <p className="text-muted-foreground">This address now receives the alerts of the Akash Console notification channel it was added to.</p>
            </>
          )}
          {view.name === "confirm" && (
            <>
              <Title subTitle>Confirm your email address</Title>
              <p className="text-muted-foreground">
                This address was added to a notification channel on Akash Console. Confirm it to start receiving the channel&apos;s alerts here.
              </p>
              <LoadingButton loading={confirmation.isPending} onClick={() => confirmation.mutate({ data: { token: view.token } })}>
                Confirm email address
              </LoadingButton>
              {confirmation.isError && <p className="text-sm text-destructive">We couldn&apos;t confirm your address just now. Try again in a moment.</p>}
            </>
          )}
        </CardContent>
      </Card>
    </d.Layout>
  );
};
