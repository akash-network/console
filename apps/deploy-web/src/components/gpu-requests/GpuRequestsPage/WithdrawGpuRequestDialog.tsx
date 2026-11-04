"use client";
import type { FC } from "react";
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

import { useWithdrawHardwareRequestMutation } from "@src/queries/useHardwareRequestsQuery";
import type { HardwareRequest } from "../gpuRequestStatus/gpuRequestStatus";
import { describeRequestTitle } from "../gpuRequestStatus/gpuRequestStatus";

export const DEPENDENCIES = { useWithdrawHardwareRequestMutation, useSnackbar };

type Props = {
  request: HardwareRequest;
  onClose: () => void;
  dependencies?: typeof DEPENDENCIES;
};

export const WithdrawGpuRequestDialog: FC<Props> = ({ request, onClose, dependencies: d = DEPENDENCIES }) => {
  const { enqueueSnackbar } = d.useSnackbar();
  const { mutate: withdrawRequest, isPending } = d.useWithdrawHardwareRequestMutation();

  const confirmWithdrawn = () => {
    enqueueSnackbar(<Snackbar title="Request withdrawn" subTitle="We've let the team know." iconVariant="success" />, { variant: "success" });
    onClose();
  };

  const reportFailure = () => {
    enqueueSnackbar(
      <Snackbar title="Couldn't withdraw your request" subTitle="It may have moved on already. Check its status and try again." iconVariant="error" />,
      {
        variant: "error"
      }
    );
    onClose();
  };

  const withdraw = () => withdrawRequest({ id: request.id }, { onSuccess: confirmWithdrawn, onError: reportFailure });

  return (
    <DialogV2 open onOpenChange={isOpen => (!isOpen && !isPending ? onClose() : undefined)}>
      <DialogV2Content className="max-w-[440px]" hideCloseButton={isPending}>
        <DialogV2Header>
          <DialogV2Title>Withdraw this request?</DialogV2Title>
          <DialogV2Description>
            We&apos;ll stop sourcing <strong className="text-foreground">{describeRequestTitle(request)}</strong> for you. You can send a new request any time.
          </DialogV2Description>
        </DialogV2Header>
        <DialogV2Footer className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" disabled={isPending} onClick={onClose}>
            Keep request
          </Button>
          <LoadingButton type="button" variant="destructive" loading={isPending} onClick={withdraw}>
            Withdraw request
          </LoadingButton>
        </DialogV2Footer>
      </DialogV2Content>
    </DialogV2>
  );
};
