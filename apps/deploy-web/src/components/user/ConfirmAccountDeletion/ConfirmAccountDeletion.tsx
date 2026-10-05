"use client";
import type { FC, ReactNode } from "react";
import { extractApiErrorCode, isApiError } from "@akashnetwork/openapi-sdk";
import { Button, buttonVariants, Card, CardContent, LoadingButton, Spinner } from "@akashnetwork/ui/components";
import Link from "next/link";
import { NextSeo } from "next-seo";

import Layout from "@src/components/layout/Layout";
import { markAccountDeleted } from "@src/components/user/AccountDeletedNotice/AccountDeletedNotice";
import { useServices } from "@src/context/ServicesProvider";
import { SKIP_REPORTING_REFUSED_INPUT } from "@src/services/query-error-policy/query-error-policy";
import { useDeletionLinkToken } from "./useDeletionLinkToken";

export const DEPENDENCIES = { Layout, useDeletionLinkToken };

type Outcome = "unavailable" | "expired" | "invalid" | "blocked" | "creditsAdded" | "failed";

function outcomeOf(error: unknown): Outcome {
  if (isApiError(error) && error.status === 404) return "unavailable";

  switch (extractApiErrorCode(error)) {
    case "expired_deletion_token":
      return "expired";
    case "invalid_deletion_token":
      return "invalid";
    case "active_deployments":
      return "blocked";
    case "forfeit_acknowledgement_required":
      return "creditsAdded";
    default:
      return "failed";
  }
}

type Props = {
  dependencies?: typeof DEPENDENCIES;
};

export const ConfirmAccountDeletion: FC<Props> = ({ dependencies: d = DEPENDENCIES }) => {
  const { api, authService, urlService } = useServices();
  const token = d.useDeletionLinkToken();
  const confirmDeletion = api.v1.confirmAccountDeletion.useMutation({ meta: SKIP_REPORTING_REFUSED_INPUT });

  const deleteAccount = (linkToken: string) => {
    confirmDeletion.mutate(
      { data: { token: linkToken } },
      {
        onSuccess: () => {
          markAccountDeleted();
          authService.logout();
        }
      }
    );
  };

  const settingsLink = <ActionLink href={urlService.userSettings()}>Go to account settings</ActionLink>;

  function renderContent() {
    if (token === undefined) return <Spinner size="medium" />;
    if (!token)
      return (
        <Message
          title="This link isn't valid"
          text="Open the link from your confirmation email, or request a new one from your account settings."
          action={settingsLink}
        />
      );
    if (confirmDeletion.isSuccess) return <Message title="Your account has been deleted" text="Signing you out…" action={<Spinner size="small" />} />;

    if (confirmDeletion.isError) {
      switch (outcomeOf(confirmDeletion.error)) {
        case "unavailable":
          return (
            <Message
              title="Account deletion isn't available"
              text="You can't delete your account from Console yet. Contact support if you need it deleted."
              action={<ActionLink href={urlService.home()}>Back to Console</ActionLink>}
            />
          );
        case "expired":
          return (
            <Message
              title="This link has expired"
              text="Deletion links work for 15 minutes. Request a new one from your account settings."
              action={settingsLink}
            />
          );
        case "invalid":
          return (
            <Message
              title="This link isn't valid"
              text="It may have been used already, or a newer link replaced it. Request a new one from your account settings."
              action={settingsLink}
            />
          );
        case "blocked":
          return (
            <Message
              title="Close your deployments first"
              text="Your account still has active deployments. Close them, then open this link again."
              action={<ActionLink href={urlService.deploymentList()}>Go to deployments</ActionLink>}
            />
          );
        case "creditsAdded":
          return (
            <Message
              title="Your account has new credits"
              text="Credits were added after you asked to delete your account. Request a new link from your account settings to confirm you want to forfeit them."
              action={settingsLink}
            />
          );
        case "failed":
          return (
            <Message
              title="We couldn't delete your account"
              text="Something went wrong on our side. Please try again."
              action={
                <Button type="button" onClick={() => deleteAccount(token)}>
                  Try again
                </Button>
              }
            />
          );
      }
    }

    return (
      <Message
        title="Delete your Akash Console account?"
        text="This permanently deletes your account, API keys, templates and saved settings. It can't be undone."
        action={
          <>
            <ActionLink href={urlService.home()} variant="ghost">
              Keep my account
            </ActionLink>
            <LoadingButton type="button" variant="destructive" loading={confirmDeletion.isPending} onClick={() => deleteAccount(token)}>
              Delete my account
            </LoadingButton>
          </>
        }
      />
    );
  }

  return (
    <d.Layout>
      <NextSeo title="Delete account" />
      <Card className="mx-auto mt-10 max-w-lg">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">{renderContent()}</CardContent>
      </Card>
    </d.Layout>
  );
};

const Message: FC<{ title: string; text: string; action: ReactNode }> = ({ title, text, action }) => (
  <>
    <h1 className="text-xl font-semibold">{title}</h1>
    <p className="text-sm text-muted-foreground">{text}</p>
    <div className="flex flex-wrap justify-center gap-2">{action}</div>
  </>
);

const ActionLink: FC<{ href: string; variant?: "default" | "ghost"; children: ReactNode }> = ({ href, variant = "default", children }) => (
  <Link href={href} className={buttonVariants({ variant })}>
    {children}
  </Link>
);
