"use client";
import type { FC } from "react";
import {
  Button,
  DialogV2,
  DialogV2Body,
  DialogV2Content,
  DialogV2Description,
  DialogV2Footer,
  DialogV2Header,
  DialogV2Title,
  LoadingButton,
  Snackbar
} from "@akashnetwork/ui/components";
import { useSnackbar } from "notistack";

import { useServices } from "@src/context/ServicesProvider";
import { useAcceptHardwareRequestOfferMutation, useDeclineHardwareRequestOfferMutation } from "@src/queries/useHardwareRequestsQuery";
import type { GpuRequestOffer } from "../gpuOfferComparison/gpuOfferComparison";
import { TERMS } from "../gpuQuoteDraft/gpuQuoteCatalog";

export const DEPENDENCIES = { useAcceptHardwareRequestOfferMutation, useDeclineHardwareRequestOfferMutation, useSnackbar, useServices };

export type OfferDecision = "accept" | "decline";

type Props = {
  decision: OfferDecision;
  requestId: string;
  offer: GpuRequestOffer;
  label: string;
  onClose: () => void;
  dependencies?: typeof DEPENDENCIES;
};

const COPY: Record<OfferDecision, { action: string; done: string; doneDetail: string; failed: string; event: "gpu_offer_accepted" | "gpu_offer_declined" }> = {
  accept: {
    event: "gpu_offer_accepted",
    action: "Accept offer",
    done: "Offer accepted",
    doneDetail: "Our team will email you about the setup.",
    failed: "Couldn't accept this offer"
  },
  decline: {
    event: "gpu_offer_declined",
    action: "Decline offer",
    done: "Offer declined",
    doneDetail: "The team can see you passed on it.",
    failed: "Couldn't decline this offer"
  }
};

export const GpuOfferDecisionDialog: FC<Props> = ({ decision, requestId, offer, label, onClose, dependencies: d = DEPENDENCIES }) => {
  const { enqueueSnackbar } = d.useSnackbar();
  const { analyticsService } = d.useServices();
  const accept = d.useAcceptHardwareRequestOfferMutation();
  const decline = d.useDeclineHardwareRequestOfferMutation();
  const { mutate, isPending } = decision === "accept" ? accept : decline;
  const copy = COPY[decision];
  const term = TERMS.find(candidate => candidate.value === offer.terms.term)?.label.toLowerCase();

  const confirmDecided = () => {
    analyticsService.track(copy.event, {
      category: "deployments",
      hardwareRequestId: requestId,
      offerId: offer.id,
      usdPerGpuHour: offer.usdPerGpuHour,
      estimatedMonthlyUsd: offer.estimatedMonthlyUsd
    });
    enqueueSnackbar(<Snackbar title={copy.done} subTitle={copy.doneDetail} iconVariant="success" />, { variant: "success" });
    onClose();
  };

  const reportFailure = () => {
    enqueueSnackbar(<Snackbar title={copy.failed} subTitle="It may have expired or been settled. Check the request and try again." iconVariant="error" />, {
      variant: "error"
    });
    onClose();
  };

  const decide = () => mutate({ id: requestId, offerId: offer.id }, { onSuccess: confirmDecided, onError: reportFailure });

  return (
    <DialogV2 open onOpenChange={isOpen => (!isOpen && !isPending ? onClose() : undefined)}>
      <DialogV2Content className="max-w-[480px]" hideCloseButton={isPending}>
        <DialogV2Header>
          <DialogV2Title>{`${decision === "accept" ? "Accept" : "Decline"} ${label}?`}</DialogV2Title>
          <DialogV2Description>
            {`${offer.terms.gpu.count}× ${offer.terms.gpu.model} in ${offer.terms.location} at $${offer.usdPerGpuHour.toFixed(2)} per GPU-hour, about $${offer.estimatedMonthlyUsd.toLocaleString("en-US")} a month.`}
          </DialogV2Description>
        </DialogV2Header>
        <DialogV2Body className="flex flex-col gap-2 text-sm">
          {decision === "accept" ? (
            <>
              <p>Our team sets up the deployment with the provider and emails you when it&apos;s ready. The other offers on this request close.</p>
              <p className="text-muted-foreground">{`The ${term} term is for your information. Console doesn't enforce it.`}</p>
            </>
          ) : (
            <p>You won&apos;t be able to accept this offer afterwards.</p>
          )}
        </DialogV2Body>
        <DialogV2Footer className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" disabled={isPending} onClick={onClose}>
            Cancel
          </Button>
          <LoadingButton type="button" variant={decision === "accept" ? "default" : "destructive"} loading={isPending} onClick={decide}>
            {copy.action}
          </LoadingButton>
        </DialogV2Footer>
      </DialogV2Content>
    </DialogV2>
  );
};
