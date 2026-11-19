"use client";
import type { FC } from "react";
import { isApiError } from "@akashnetwork/openapi-sdk";
import {
  Button,
  DialogV2,
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
import { useLeaveGpuWaitlistMutation } from "@src/queries/useGpuWaitlistQuery";

export const DEPENDENCIES = { useLeaveGpuWaitlistMutation, useSnackbar, useServices };

export type LeavableGpuAlert = { id: string; model: string; gpuCount: number };

type Props = {
  entry: LeavableGpuAlert;
  label: string;
  onClose: () => void;
  dependencies?: typeof DEPENDENCIES;
};

export const LeaveGpuAlertDialog: FC<Props> = ({ entry, label, onClose, dependencies: d = DEPENDENCIES }) => {
  const { enqueueSnackbar } = d.useSnackbar();
  const { analyticsService } = d.useServices();
  const { mutate: leave, isPending } = d.useLeaveGpuWaitlistMutation();

  const confirmLeft = () => {
    analyticsService.track("gpu_alert_left", { category: "deployments", model: entry.model, gpuCount: entry.gpuCount });
    enqueueSnackbar(<Snackbar title="You left the alert" subTitle={`We won't email you about ${label} anymore.`} iconVariant="success" />, {
      variant: "success"
    });
    onClose();
  };

  const explainFailure = (error: unknown) => {
    const hasAlreadyEnded = isApiError(error) && error.status === 404;
    enqueueSnackbar(
      hasAlreadyEnded ? (
        <Snackbar title="This alert has already ended" iconVariant="info" />
      ) : (
        <Snackbar title="Couldn't leave the alert" subTitle="Try again in a moment." iconVariant="error" />
      ),
      { variant: hasAlreadyEnded ? "info" : "error" }
    );
    onClose();
  };

  return (
    <DialogV2 open onOpenChange={isOpen => (!isOpen && !isPending ? onClose() : undefined)}>
      <DialogV2Content className="max-w-[440px]" hideCloseButton={isPending}>
        <DialogV2Header>
          <DialogV2Title>Leave this alert?</DialogV2Title>
          <DialogV2Description>
            You&apos;ll stop getting emails when <strong className="text-foreground">{label}</strong> frees up. You can join again any time.
          </DialogV2Description>
        </DialogV2Header>
        <DialogV2Footer className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" disabled={isPending} onClick={onClose}>
            Keep alert
          </Button>
          <LoadingButton
            type="button"
            variant="destructive"
            loading={isPending}
            onClick={() => leave({ id: entry.id }, { onSuccess: confirmLeft, onError: explainFailure })}
          >
            Leave alert
          </LoadingButton>
        </DialogV2Footer>
      </DialogV2Content>
    </DialogV2>
  );
};
