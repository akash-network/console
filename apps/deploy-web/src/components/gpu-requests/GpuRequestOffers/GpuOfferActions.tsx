"use client";
import type { FC } from "react";
import { useState } from "react";
import { Button, Snackbar } from "@akashnetwork/ui/components";
import { useSnackbar } from "notistack";

import { useRequestHardwareRequestOfferApprovalMutation } from "@src/queries/useHardwareRequestsQuery";
import type { GpuRequestOffer } from "../gpuOfferComparison/gpuOfferComparison";
import type { OfferDecisions } from "../gpuRequestAccess/gpuRequestAccess";
import type { OfferDecision } from "./GpuOfferDecisionDialog";
import { GpuOfferDecisionDialog } from "./GpuOfferDecisionDialog";

export const DEPENDENCIES = { useRequestHardwareRequestOfferApprovalMutation, useSnackbar, GpuOfferDecisionDialog };

type Props = {
  requestId: string;
  offer: GpuRequestOffer;
  label: string;
  decisions: OfferDecisions;
  dependencies?: typeof DEPENDENCIES;
};

export const GpuOfferActions: FC<Props> = ({ requestId, offer, label, decisions, dependencies: d = DEPENDENCIES }) => {
  const { enqueueSnackbar } = d.useSnackbar();
  const { mutate: askForApproval, isPending: isAsking } = d.useRequestHardwareRequestOfferApprovalMutation();
  const [decision, setDecision] = useState<OfferDecision | null>(null);

  const askAnAdmin = () =>
    askForApproval(
      { id: requestId, offerId: offer.id },
      {
        onSuccess: () =>
          enqueueSnackbar(<Snackbar title="Approval requested" subTitle="We emailed your organization's owners and admins." iconVariant="success" />, {
            variant: "success"
          }),
        onError: () => enqueueSnackbar(<Snackbar title="Couldn't ask for approval" subTitle="Please try again." iconVariant="error" />, { variant: "error" })
      }
    );

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {decisions.canAccept && (
        <Button type="button" size="sm" aria-label={`Accept ${label}`} onClick={() => setDecision("accept")}>
          Accept
        </Button>
      )}
      {decisions.canAskForApproval && (
        <Button type="button" size="sm" variant="outline" aria-label={`Ask an admin to accept ${label}`} disabled={isAsking} onClick={askAnAdmin}>
          Ask an admin to accept
        </Button>
      )}
      {decisions.canDecline && (
        <Button type="button" size="sm" variant="ghost" aria-label={`Decline ${label}`} onClick={() => setDecision("decline")}>
          Decline
        </Button>
      )}
      {decision && <d.GpuOfferDecisionDialog decision={decision} requestId={requestId} offer={offer} label={label} onClose={() => setDecision(null)} />}
    </div>
  );
};
