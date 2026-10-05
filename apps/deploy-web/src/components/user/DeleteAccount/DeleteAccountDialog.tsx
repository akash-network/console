"use client";
import type { FC } from "react";
import { useId, useState } from "react";
import { extractApiErrorCode, extractApiErrorMessage, isApiError } from "@akashnetwork/openapi-sdk";
import {
  Alert,
  Button,
  buttonVariants,
  Checkbox,
  DialogV2,
  DialogV2Body,
  DialogV2Content,
  DialogV2Description,
  DialogV2Footer,
  DialogV2Header,
  DialogV2Title,
  Input,
  LoadingButton,
  Spinner
} from "@akashnetwork/ui/components";
import Link from "next/link";

import { UsdValue } from "@src/components/billing-usage/UsdValue/UsdValue";
import { useServices } from "@src/context/ServicesProvider";
import { SKIP_REPORTING_REFUSED_INPUT } from "@src/services/query-error-policy/query-error-policy";
import { type AccountDeletionEligibility, useAccountDeletionEligibility } from "./useAccountDeletionEligibility";

export const DEPENDENCIES = { useAccountDeletionEligibility };

type Step =
  | { name: "assess" }
  | { name: "blocked"; activeDeploymentCount: number }
  | { name: "forfeitChoice"; balanceUsd: number }
  | { name: "confirm"; forfeitedBalanceUsd: number }
  | { name: "emailSent" };

type DeletionRefusalBody = { data?: { activeDeploymentCount?: number; balanceUsd?: number } };

function stepFor(eligibility: AccountDeletionEligibility): Step | undefined {
  switch (eligibility.status) {
    case "blocked":
      return { name: "blocked", activeDeploymentCount: eligibility.activeDeploymentCount };
    case "forfeit":
      return { name: "forfeitChoice", balanceUsd: eligibility.balanceUsd };
    case "clean":
      return { name: "confirm", forfeitedBalanceUsd: 0 };
  }
}

function stepForRefusal(error: unknown): Step | undefined {
  const data = isApiError(error) ? (error.body as DeletionRefusalBody | undefined)?.data : undefined;

  switch (extractApiErrorCode(error)) {
    case "active_deployments":
      return { name: "blocked", activeDeploymentCount: data?.activeDeploymentCount ?? 1 };
    case "forfeit_acknowledgement_required":
      return { name: "forfeitChoice", balanceUsd: data?.balanceUsd ?? 0 };
  }
}

type Props = {
  email: string;
  onClose: () => void;
  dependencies?: typeof DEPENDENCIES;
};

export const DeleteAccountDialog: FC<Props> = ({ email, onClose, dependencies: d = DEPENDENCIES }) => {
  const { api } = useServices();
  const eligibility = d.useAccountDeletionEligibility();
  const [chosenStep, setChosenStep] = useState<Step>({ name: "assess" });
  const requestDeletion = api.v1.createAccountDeletionRequest.useMutation({ meta: SKIP_REPORTING_REFUSED_INPUT });
  const step = chosenStep.name === "assess" ? stepFor(eligibility) : chosenStep;

  const sendConfirmationEmail = (forfeitAcknowledged: boolean) => {
    requestDeletion.mutate(
      { data: { forfeitAcknowledged } },
      {
        onSuccess: () => setChosenStep({ name: "emailSent" }),
        onError: error => {
          const refusalStep = stepForRefusal(error);
          if (refusalStep) setChosenStep(refusalStep);
        }
      }
    );
  };

  return (
    <DialogV2 open onOpenChange={isOpen => (!isOpen && !requestDeletion.isPending ? onClose() : undefined)}>
      <DialogV2Content className="max-w-lg" hideCloseButton={requestDeletion.isPending}>
        {!step && <LoadingStep />}
        {step?.name === "blocked" && <BlockedStep activeDeploymentCount={step.activeDeploymentCount} onClose={onClose} />}
        {step?.name === "forfeitChoice" && (
          <ForfeitChoiceStep balanceUsd={step.balanceUsd} onForfeit={() => setChosenStep({ name: "confirm", forfeitedBalanceUsd: step.balanceUsd })} />
        )}
        {step?.name === "confirm" && (
          <ConfirmStep
            email={email}
            forfeitedBalanceUsd={step.forfeitedBalanceUsd}
            isSending={requestDeletion.isPending}
            error={requestDeletion.error && !stepForRefusal(requestDeletion.error) ? requestDeletion.error : null}
            onSend={sendConfirmationEmail}
            onCancel={onClose}
          />
        )}
        {step?.name === "emailSent" && <EmailSentStep email={email} onClose={onClose} />}
      </DialogV2Content>
    </DialogV2>
  );
};

const LoadingStep: FC = () => (
  <>
    <DialogV2Header>
      <DialogV2Title>Delete your account</DialogV2Title>
      <DialogV2Description>Checking your deployments and credits…</DialogV2Description>
    </DialogV2Header>
    <DialogV2Body className="flex justify-center py-6">
      <Spinner size="medium" />
    </DialogV2Body>
  </>
);

const BlockedStep: FC<{ activeDeploymentCount: number; onClose: () => void }> = ({ activeDeploymentCount, onClose }) => {
  const { urlService } = useServices();

  return (
    <>
      <DialogV2Header>
        <DialogV2Title>Close your deployments first</DialogV2Title>
        <DialogV2Description>
          You have {activeDeploymentCount} active {activeDeploymentCount === 1 ? "deployment" : "deployments"}. Close{" "}
          {activeDeploymentCount === 1 ? "it" : "them"} before you delete your account.
        </DialogV2Description>
      </DialogV2Header>
      <DialogV2Footer className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Link href={urlService.deploymentList()} className={buttonVariants({ variant: "default" })}>
          Go to deployments
        </Link>
      </DialogV2Footer>
    </>
  );
};

const ForfeitChoiceStep: FC<{ balanceUsd: number; onForfeit: () => void }> = ({ balanceUsd, onForfeit }) => {
  const { analyticsService, publicConfig } = useServices();

  const trackSupportChosen = () => analyticsService.track("account_deletion_support_clicked", { category: "user", label: "Contact support about credits" });
  const forfeitCredits = () => {
    analyticsService.track("account_deletion_forfeit_chosen", { category: "user", label: "Delete account and forfeit credits" });
    onForfeit();
  };

  return (
    <>
      <DialogV2Header>
        <DialogV2Title>
          You still have <UsdValue value={balanceUsd} /> in credits
        </DialogV2Title>
        <DialogV2Description>
          If you delete your account, you lose these credits and we can&apos;t refund them later. If you want a refund, contact support first.
        </DialogV2Description>
      </DialogV2Header>
      <DialogV2Footer className="flex items-center justify-end gap-2">
        <a
          href={publicConfig.NEXT_PUBLIC_CONTACT_SUPPORT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "outline" })}
          onClick={trackSupportChosen}
        >
          Contact support
        </a>
        <Button type="button" variant="destructive" onClick={forfeitCredits}>
          Delete and forfeit
        </Button>
      </DialogV2Footer>
    </>
  );
};

type ConfirmStepProps = {
  email: string;
  forfeitedBalanceUsd: number;
  isSending: boolean;
  error: Error | null;
  onSend: (forfeitAcknowledged: boolean) => void;
  onCancel: () => void;
};

const ConfirmStep: FC<ConfirmStepProps> = ({ email, forfeitedBalanceUsd, isSending, error, onSend, onCancel }) => {
  const formId = useId();
  const forfeitCheckboxId = useId();
  const [typedEmail, setTypedEmail] = useState("");
  const [isForfeitAcknowledged, setIsForfeitAcknowledged] = useState(false);
  const isForfeiting = forfeitedBalanceUsd > 0;
  const canSend = typedEmail.toLowerCase() === email.toLowerCase() && (!isForfeiting || isForfeitAcknowledged);
  const errorMessage = isApiError(error) && error.status === 429 ? extractApiErrorMessage(error) : "We couldn't send the email. Please try again.";

  return (
    <>
      <DialogV2Header>
        <DialogV2Title>Delete your account?</DialogV2Title>
        <DialogV2Description>
          This permanently deletes your Akash Console account, API keys, templates and saved settings. It can&apos;t be undone. We&apos;ll email you a link to
          finish the deletion.
        </DialogV2Description>
      </DialogV2Header>
      <DialogV2Body>
        <form
          id={formId}
          className="flex flex-col gap-4"
          onSubmit={event => {
            event.preventDefault();
            if (canSend) onSend(isForfeiting);
          }}
        >
          {isForfeiting && (
            <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
              <Checkbox
                id={forfeitCheckboxId}
                checked={isForfeitAcknowledged}
                onCheckedChange={checked => setIsForfeitAcknowledged(checked === true)}
                className="mt-0.5"
              />
              <label htmlFor={forfeitCheckboxId} className="cursor-pointer text-sm">
                I understand my remaining <UsdValue value={forfeitedBalanceUsd} /> in credits won&apos;t be refunded.
              </label>
            </div>
          )}
          <Input
            label={
              <>
                Type <span className="font-semibold">{email}</span> to confirm
              </>
            }
            type="email"
            autoComplete="off"
            value={typedEmail}
            onChange={event => setTypedEmail(event.target.value)}
            disabled={isSending}
          />
          {error && <Alert variant="destructive">{errorMessage}</Alert>}
        </form>
      </DialogV2Body>
      <DialogV2Footer className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" disabled={isSending} onClick={onCancel}>
          Cancel
        </Button>
        <LoadingButton type="submit" form={formId} variant="destructive" loading={isSending} disabled={!canSend}>
          Send confirmation email
        </LoadingButton>
      </DialogV2Footer>
    </>
  );
};

const EmailSentStep: FC<{ email: string; onClose: () => void }> = ({ email, onClose }) => (
  <>
    <DialogV2Header>
      <DialogV2Title>Check your email</DialogV2Title>
      <DialogV2Description>
        We sent a link to <span className="font-semibold text-foreground">{email}</span>. Open it within 15 minutes to delete your account. Until then, nothing
        changes.
      </DialogV2Description>
    </DialogV2Header>
    <DialogV2Footer className="flex items-center justify-end">
      <Button type="button" onClick={onClose}>
        Done
      </Button>
    </DialogV2Footer>
  </>
);
