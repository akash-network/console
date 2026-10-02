"use client";
import type { FC } from "react";
import { useId, useState } from "react";
import {
  Alert,
  AlertDescription,
  Button,
  DialogV2,
  DialogV2Body,
  DialogV2Content,
  DialogV2Description,
  DialogV2Footer,
  DialogV2Header,
  DialogV2Title,
  Field,
  FieldLabel,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea
} from "@akashnetwork/ui/components";
import { TriangleAlertIcon } from "lucide-react";

import type { DeploymentCloseReason, DeploymentCloseReasonInput } from "./closeDeploymentReasons";
import { DEPLOYMENT_CLOSE_REASONS, MAX_CLOSE_REASON_DETAILS_LENGTH, toCloseReasonInput } from "./closeDeploymentReasons";

export type CloseDeploymentTarget = { dseqs: string[]; name?: string | null };

type Props = {
  target: CloseDeploymentTarget;
  onConfirm: (reason: DeploymentCloseReasonInput) => void;
  onCancel: () => void;
};

export const CloseDeploymentDialog: FC<Props> = ({ target, onConfirm, onCancel }) => {
  const [closeReason, setCloseReason] = useState<DeploymentCloseReason>();
  const [details, setDetails] = useState("");
  const fieldIds = { reason: useId(), details: useId() };
  const count = target.dseqs.length;
  const isClosingSeveral = count > 1;

  function confirmWithReason() {
    if (closeReason) onConfirm(toCloseReasonInput(closeReason, details));
  }

  return (
    <DialogV2 open onOpenChange={isOpen => (!isOpen ? onCancel() : undefined)}>
      <DialogV2Content className="max-w-md">
        <DialogV2Header>
          <DialogV2Title>{isClosingSeveral ? `Close ${count} deployments?` : "Close this deployment?"}</DialogV2Title>
          <DialogV2Description>
            {isClosingSeveral ? (
              <>Closing these {count} deployments settles their leases and permanently tears them down. This can&apos;t be undone.</>
            ) : (
              <>
                Closing <span className="font-semibold text-foreground">{target.name || `deployment ${target.dseqs[0]}`}</span> settles its leases and
                permanently tears it down. This can&apos;t be undone.
              </>
            )}
          </DialogV2Description>
        </DialogV2Header>

        <DialogV2Body className="flex flex-col gap-4">
          <Alert variant="destructive" className="bg-destructive/10 p-4 text-foreground">
            <TriangleAlertIcon className="h-4 w-4" aria-hidden="true" />
            <AlertDescription>
              {isClosingSeveral
                ? "All services stop immediately and the deployment URLs stop resolving. Any unspent balance is returned to your wallet. You'll need to create new deployments to run these workloads again."
                : "All services stop immediately and the deployment URL stops resolving. Any unspent balance is returned to your wallet. You'll need to create a new deployment to run this workload again."}
            </AlertDescription>
          </Alert>

          <Field className="gap-2">
            <FieldLabel htmlFor={fieldIds.reason}>
              {isClosingSeveral ? "Why are you closing these deployments?" : "Why are you closing this deployment?"}
            </FieldLabel>
            <Select value={closeReason} onValueChange={value => setCloseReason(value as DeploymentCloseReason)}>
              <SelectTrigger id={fieldIds.reason}>
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {DEPLOYMENT_CLOSE_REASONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {closeReason === "other" && (
            <Field className="gap-2">
              <FieldLabel htmlFor={fieldIds.details}>Tell us more (optional)</FieldLabel>
              <Textarea
                id={fieldIds.details}
                rows={3}
                maxLength={MAX_CLOSE_REASON_DETAILS_LENGTH}
                value={details}
                onChange={event => setDetails(event.target.value)}
              />
            </Field>
          )}
        </DialogV2Body>

        <DialogV2Footer className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" disabled={!closeReason} onClick={confirmWithReason}>
            {isClosingSeveral ? `Close ${count} deployments` : "Close deployment"}
          </Button>
        </DialogV2Footer>
      </DialogV2Content>
    </DialogV2>
  );
};
