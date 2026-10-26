"use client";
import type { FC, ReactNode } from "react";
import { useState } from "react";
import { extractApiErrorCode } from "@akashnetwork/openapi-sdk";
import { LoadingButton, Snackbar } from "@akashnetwork/ui/components";
import { Check, Lock } from "lucide-react";
import { useSnackbar } from "notistack";

import { ORGANIZATION_ROLE_LABELS } from "@src/components/organizations/organizationAccess";
import { useRequestAdminAccessMutation } from "@src/queries/useOrganizationQueries";
import type { OrganizationOutput } from "@src/types/organization";
import { ADMIN_ACCESS_REQUEST_LIMIT_REACHED_ERROR_CODE } from "@src/types/organizationMembership";

export const DEPENDENCIES = { useRequestAdminAccessMutation, useSnackbar };

type RequestOutcome = "sent" | "alreadySent";

type Props = {
  organization: Pick<OrganizationOutput, "id" | "name" | "role">;
  adminOnlyAction: string;
  dependencies?: typeof DEPENDENCIES;
};

export const AdminAccessRequestNotice: FC<Props> = ({ organization, adminOnlyAction, dependencies: d = DEPENDENCIES }) => {
  const { mutate: requestAdminAccess, isPending } = d.useRequestAdminAccessMutation();
  const { enqueueSnackbar } = d.useSnackbar();
  const [outcome, setOutcome] = useState<RequestOutcome>();

  const reportFailure = (error: unknown) => {
    if (extractApiErrorCode(error) === ADMIN_ACCESS_REQUEST_LIMIT_REACHED_ERROR_CODE) {
      setOutcome("alreadySent");
      return;
    }

    enqueueSnackbar(<Snackbar title="Couldn't send your request" subTitle="Try again in a moment." iconVariant="error" />, { variant: "error" });
  };

  const askForAdminAccess = () => requestAdminAccess({ id: organization.id }, { onSuccess: () => setOutcome("sent"), onError: reportFailure });

  const Icon = outcome ? Check : Lock;
  const messages: Record<RequestOutcome, ReactNode> = {
    sent: <>Request sent. The owner of {organization.name} will get an email.</>,
    alreadySent: <>You already asked today. The owner of {organization.name} has your request.</>
  };

  return (
    <div className="flex flex-col gap-3 rounded-[10px] border border-border bg-card px-3.5 py-3 text-[13px] text-muted-foreground sm:flex-row sm:items-center">
      <p aria-live="polite" className="flex flex-1 items-start gap-2">
        <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          {outcome ? (
            messages[outcome]
          ) : (
            <>
              You&apos;re a <strong className="text-foreground">{ORGANIZATION_ROLE_LABELS[organization.role]}</strong> of {organization.name}. Only admins can{" "}
              {adminOnlyAction}.
            </>
          )}
        </span>
      </p>
      <LoadingButton
        type="button"
        size="sm"
        variant="outline"
        className="w-full shrink-0 sm:w-auto"
        loading={isPending}
        disabled={!!outcome}
        onClick={askForAdminAccess}
      >
        {outcome ? "Requested" : "Request admin access"}
      </LoadingButton>
    </div>
  );
};
