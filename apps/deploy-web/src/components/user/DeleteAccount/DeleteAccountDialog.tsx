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
import { type AccountDeletionEligibility, type TeamReference, useAccountDeletionEligibility } from "./useAccountDeletionEligibility";

export const DEPENDENCIES = { useAccountDeletionEligibility };

type Step =
  | { name: "assess" }
  | { name: "blocked"; activeDeploymentCount: number; teamsWithDeployments: TeamReference[] }
  | { name: "transfer"; teamsToTransfer: TeamReference[] }
  | { name: "forfeitChoice"; balanceUsd: number }
  | { name: "confirm"; forfeitedBalanceUsd: number }
  | { name: "emailSent" };

type DeletionRefusalBody = { data?: { activeDeploymentCount?: number; balanceUsd?: number; organizations?: TeamReference[] } };

function stepFor(eligibility: AccountDeletionEligibility): Step | undefined {
  switch (eligibility.status) {
    case "blocked":
      return { name: "blocked", activeDeploymentCount: eligibility.activeDeploymentCount, teamsWithDeployments: eligibility.teamsWithDeployments };
    case "transfer":
      return { name: "transfer", teamsToTransfer: eligibility.teamsToTransfer };
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
      return { name: "blocked", activeDeploymentCount: data?.activeDeploymentCount ?? 1, teamsWithDeployments: [] };
    case "last_owner":
      return { name: "transfer", teamsToTransfer: data?.organizations ?? [] };
    case "forfeit_acknowledgement_required":
      return { name: "forfeitChoice", balanceUsd: data?.balanceUsd ?? 0 };
  }
}

function teamsDeletedWith(eligibility: AccountDeletionEligibility): TeamReference[] {
  return eligibility.status === "forfeit" || eligibility.status === "clean" ? eligibility.teamsDeletedWithAccount : [];
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
  const teamsDeletedWithAccount = teamsDeletedWith(eligibility);

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
        {step?.name === "blocked" && (
          <BlockedStep activeDeploymentCount={step.activeDeploymentCount} teamsWithDeployments={step.teamsWithDeployments} onClose={onClose} />
        )}
        {step?.name === "transfer" && <TransferStep teamsToTransfer={step.teamsToTransfer} onClose={onClose} />}
        {step?.name === "forfeitChoice" && (
          <ForfeitChoiceStep
            balanceUsd={step.balanceUsd}
            includesTeams={teamsDeletedWithAccount.length > 0}
            onForfeit={() => setChosenStep({ name: "confirm", forfeitedBalanceUsd: step.balanceUsd })}
          />
        )}
        {step?.name === "confirm" && (
          <ConfirmStep
            email={email}
            forfeitedBalanceUsd={step.forfeitedBalanceUsd}
            teamsDeletedWithAccount={teamsDeletedWithAccount}
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

const TeamList: FC<{ teams: TeamReference[] }> = ({ teams }) => (
  <ul className="list-disc space-y-1 pl-5 text-sm">
    {teams.map(team => (
      <li key={team.id}>{team.name}</li>
    ))}
  </ul>
);

const BlockedStep: FC<{ activeDeploymentCount: number; teamsWithDeployments: TeamReference[]; onClose: () => void }> = ({
  activeDeploymentCount,
  teamsWithDeployments,
  onClose
}) => {
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
      {teamsWithDeployments.length > 0 && (
        <DialogV2Body className="flex flex-col gap-2">
          <p className="text-sm">Some run in teams that are deleted with your account:</p>
          <TeamList teams={teamsWithDeployments} />
        </DialogV2Body>
      )}
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

const TransferStep: FC<{ teamsToTransfer: TeamReference[]; onClose: () => void }> = ({ teamsToTransfer, onClose }) => (
  <>
    <DialogV2Header>
      <DialogV2Title>Hand over your teams first</DialogV2Title>
      <DialogV2Description>
        You&apos;re the last owner of teams other people belong to. Make another member an owner of each one before you delete your account.
      </DialogV2Description>
    </DialogV2Header>
    <DialogV2Body>
      <TeamList teams={teamsToTransfer} />
    </DialogV2Body>
    <DialogV2Footer className="flex items-center justify-end">
      <Button type="button" onClick={onClose}>
        Got it
      </Button>
    </DialogV2Footer>
  </>
);

const ForfeitChoiceStep: FC<{ balanceUsd: number; includesTeams: boolean; onForfeit: () => void }> = ({ balanceUsd, includesTeams, onForfeit }) => {
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
          {includesTeams && "This includes the credits of the teams deleted with your account. "}
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
  teamsDeletedWithAccount: TeamReference[];
  isSending: boolean;
  error: Error | null;
  onSend: (forfeitAcknowledged: boolean) => void;
  onCancel: () => void;
};

const ConfirmStep: FC<ConfirmStepProps> = ({ email, forfeitedBalanceUsd, teamsDeletedWithAccount, isSending, error, onSend, onCancel }) => {
  const formId = useId();
  const forfeitCheckboxId = useId();
  const [typedEmail, setTypedEmail] = useState("");
  const [isForfeitAcknowledged, setIsForfeitAcknowledged] = useState(false);
  const isForfeiting = forfeitedBalanceUsd > 0;
  const hasTeamsDeletedWithAccount = teamsDeletedWithAccount.length > 0;
  const canSend = typedEmail.toLowerCase() === email.toLowerCase() && (!isForfeiting || isForfeitAcknowledged);
  const rateLimitMessage = isApiError(error) && error.status === 429 ? extractApiErrorMessage(error) : null;
  const errorMessage = rateLimitMessage ?? "We couldn't send the email. Please try again.";

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
          {hasTeamsDeletedWithAccount && (
            <div className="flex flex-col gap-2">
              <p className="text-sm">You&apos;re the only member of these teams, so they&apos;re deleted with your account:</p>
              <TeamList teams={teamsDeletedWithAccount} />
            </div>
          )}
          {isForfeiting && (
            <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
              <Checkbox
                id={forfeitCheckboxId}
                checked={isForfeitAcknowledged}
                onCheckedChange={checked => setIsForfeitAcknowledged(checked === true)}
                className="mt-0.5"
              />
              <label htmlFor={forfeitCheckboxId} className="cursor-pointer text-sm">
                {hasTeamsDeletedWithAccount ? (
                  <>
                    I understand the remaining <UsdValue value={forfeitedBalanceUsd} /> in credits of my account and these teams won&apos;t be refunded.
                  </>
                ) : (
                  <>
                    I understand my remaining <UsdValue value={forfeitedBalanceUsd} /> in credits won&apos;t be refunded.
                  </>
                )}
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
