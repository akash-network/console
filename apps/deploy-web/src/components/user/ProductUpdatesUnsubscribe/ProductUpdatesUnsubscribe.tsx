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

const SUPPORT_EMAIL = "support@akash.network";

type View = { name: "waiting-for-router" } | { name: "invalid-link" } | { name: "unsubscribed" } | { name: "confirm"; token: string };

function isRefusedLinkError(error: unknown): boolean {
  return isApiError(error) && error.status === 400;
}

function getView(isRouterReady: boolean, token: string | undefined, unsubscription: { isSuccess: boolean; error: unknown }): View {
  if (!isRouterReady) return { name: "waiting-for-router" };
  if (!token || isRefusedLinkError(unsubscription.error)) return { name: "invalid-link" };
  if (unsubscription.isSuccess) return { name: "unsubscribed" };
  return { name: "confirm", token };
}

type Props = {
  dependencies?: typeof DEPENDENCIES;
};

export const ProductUpdatesUnsubscribe: React.FunctionComponent<Props> = ({ dependencies: d = DEPENDENCIES }) => {
  const router = d.useRouter();
  const { api } = useServices();
  const unsubscription = api.v1.createProductUpdateUnsubscription.useMutation({ meta: SKIP_REPORTING_REFUSED_INPUT });
  const view = getView(router.isReady, typeof router.query.token === "string" ? router.query.token : undefined, unsubscription);

  return (
    <d.Layout>
      <NextSeo title="Unsubscribe from product updates" noindex nofollow />

      <Card className="mx-auto mt-10 max-w-xl">
        <CardContent className="space-y-4 p-6">
          {view.name === "invalid-link" && (
            <>
              <Title subTitle>This link doesn&apos;t work</Title>
              <p className="text-muted-foreground">
                Open the unsubscribe link from the email again, or email{" "}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="text-foreground underline">
                  {SUPPORT_EMAIL}
                </a>{" "}
                and we&apos;ll take you off the list.
              </p>
            </>
          )}
          {view.name === "unsubscribed" && (
            <>
              <Title subTitle>You&apos;re unsubscribed</Title>
              <p className="text-muted-foreground">You won&apos;t get product update emails from Akash Console anymore.</p>
            </>
          )}
          {view.name === "confirm" && (
            <>
              <Title subTitle>Unsubscribe from product updates</Title>
              <p className="text-muted-foreground">
                You&apos;ll stop getting product update emails from Akash Console. You&apos;ll still get emails about your account, billing and deployment
                alerts.
              </p>
              <LoadingButton loading={unsubscription.isPending} onClick={() => unsubscription.mutate({ token: view.token })}>
                Unsubscribe
              </LoadingButton>
              {unsubscription.isError && <p className="text-sm text-destructive">We couldn&apos;t unsubscribe you just now. Try again in a moment.</p>}
            </>
          )}
        </CardContent>
      </Card>
    </d.Layout>
  );
};
