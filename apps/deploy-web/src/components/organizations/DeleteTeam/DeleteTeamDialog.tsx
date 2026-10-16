"use client";
import type { FC } from "react";
import { useId, useState } from "react";
import { extractApiErrorCode, isApiError } from "@akashnetwork/openapi-sdk";
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
  Snackbar,
  Spinner
} from "@akashnetwork/ui/components";
import Link from "next/link";
import { useSnackbar } from "notistack";

import { UsdValue } from "@src/components/billing-usage/UsdValue/UsdValue";
import { useWalletDeletionEligibility, type WalletDeletionEligibility } from "@src/components/user/DeleteAccount/useAccountDeletionEligibility";
import { useActiveOrganization } from "@src/context/OrganizationProvider/OrganizationProvider";
import { useServices } from "@src/context/ServicesProvider";
import { useDeleteOrganizationMutation } from "@src/queries/useOrganizationQueries";
import type { OrganizationOutput } from "@src/types/organization";
import { UrlService } from "@src/utils/urlUtils";

export const DEPENDENCIES = { useWalletDeletionEligibility, useDeleteOrganizationMutation, useActiveOrganization, useSnackbar };

type Step =
  | { name: "assess" }
  | { name: "blocked"; activeDeploymentCount: number }
  | { name: "forfeitChoice"; balanceUsd: number }
  | { name: "confirm"; forfeitedBalanceUsd: number };

type DeletionRefusalBody = { data?: { activeDeploymentCount?: number; balanceUsd?: number } };

function stepFor(eligibility: WalletDeletionEligibility): Step | undefined {
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
  organization: Pick<OrganizationOutput, "id" | "name">;
  onClose: () => void;
  dependencies?: typeof DEPENDENCIES;
};

export const DeleteTeamDialog: FC<Props> = ({ organization, onClose, dependencies: d = DEPENDENCIES }) => {
  const eligibility = d.useWalletDeletionEligibility();
  const { organizations, switchOrganization } = d.useActiveOrganization();
  const { enqueueSnackbar } = d.useSnackbar();
  const deleteOrganization = d.useDeleteOrganizationMutation();
  const [chosenStep, setChosenStep] = useState<Step>({ name: "assess" });
  const step = chosenStep.name === "assess" ? stepFor(eligibility) : chosenStep;

  const deleteTeam = (acknowledgedForfeitUsd: number) => {
    deleteOrganization.mutate(
      { id: organization.id, acknowledgedForfeitUsd },
      {
        onSuccess: () => {
          enqueueSnackbar(<Snackbar title={`Deleted ${organization.name}`} iconVariant="success" />, { variant: "success" });
          const personal = organizations.find(candidate => candidate.type === "personal");
          if (personal) switchOrganization(personal.id, { destination: UrlService.home() });
          onClose();
        },
        onError: error => {
          const refusalStep = stepForRefusal(error);
          if (refusalStep) setChosenStep(refusalStep);
        }
      }
    );
  };

  return (
    <DialogV2 open onOpenChange={isOpen => (!isOpen && !deleteOrganization.isPending ? onClose() : undefined)}>
      <DialogV2Content className="max-w-lg" hideCloseButton={deleteOrganization.isPending}>
        {!step && <LoadingStep teamName={organization.name} />}
        {step?.name === "blocked" && <BlockedStep teamName={organization.name} activeDeploymentCount={step.activeDeploymentCount} onClose={onClose} />}
        {step?.name === "forfeitChoice" && (
          <ForfeitChoiceStep
            teamName={organization.name}
            balanceUsd={step.balanceUsd}
            onForfeit={() => setChosenStep({ name: "confirm", forfeitedBalanceUsd: step.balanceUsd })}
          />
        )}
        {step?.name === "confirm" && (
          <ConfirmStep
            teamName={organization.name}
            forfeitedBalanceUsd={step.forfeitedBalanceUsd}
            isDeleting={deleteOrganization.isPending}
            hasFailed={!!deleteOrganization.error && !stepForRefusal(deleteOrganization.error)}
            onDelete={deleteTeam}
            onCancel={onClose}
          />
        )}
      </DialogV2Content>
    </DialogV2>
  );
};

const LoadingStep: FC<{ teamName: string }> = ({ teamName }) => (
  <>
    <DialogV2Header>
      <DialogV2Title>Delete {teamName}</DialogV2Title>
      <DialogV2Description>Checking the team&apos;s deployments and credits…</DialogV2Description>
    </DialogV2Header>
    <DialogV2Body className="flex justify-center py-6">
      <Spinner size="medium" />
    </DialogV2Body>
  </>
);

const BlockedStep: FC<{ teamName: string; activeDeploymentCount: number; onClose: () => void }> = ({ teamName, activeDeploymentCount, onClose }) => {
  const { urlService } = useServices();

  return (
    <>
      <DialogV2Header>
        <DialogV2Title>Close the team&apos;s deployments first</DialogV2Title>
        <DialogV2Description>
          {teamName} has {activeDeploymentCount} active {activeDeploymentCount === 1 ? "deployment" : "deployments"}. Close{" "}
          {activeDeploymentCount === 1 ? "it" : "them"} before you delete the team.
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

const ForfeitChoiceStep: FC<{ teamName: string; balanceUsd: number; onForfeit: () => void }> = ({ teamName, balanceUsd, onForfeit }) => {
  const { publicConfig } = useServices();

  return (
    <>
      <DialogV2Header>
        <DialogV2Title>
          {teamName} still has <UsdValue value={balanceUsd} /> in credits
        </DialogV2Title>
        <DialogV2Description>
          If you delete the team, it loses these credits and we can&apos;t refund them later. If you want a refund, contact support first.
        </DialogV2Description>
      </DialogV2Header>
      <DialogV2Footer className="flex items-center justify-end gap-2">
        <a href={publicConfig.NEXT_PUBLIC_CONTACT_SUPPORT_URL} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline" })}>
          Contact support
        </a>
        <Button type="button" variant="destructive" onClick={onForfeit}>
          Delete and forfeit
        </Button>
      </DialogV2Footer>
    </>
  );
};

type ConfirmStepProps = {
  teamName: string;
  forfeitedBalanceUsd: number;
  isDeleting: boolean;
  hasFailed: boolean;
  onDelete: (acknowledgedForfeitUsd: number) => void;
  onCancel: () => void;
};

const ConfirmStep: FC<ConfirmStepProps> = ({ teamName, forfeitedBalanceUsd, isDeleting, hasFailed, onDelete, onCancel }) => {
  const formId = useId();
  const forfeitCheckboxId = useId();
  const [typedName, setTypedName] = useState("");
  const [isForfeitAcknowledged, setIsForfeitAcknowledged] = useState(false);
  const isForfeiting = forfeitedBalanceUsd > 0;
  const canDelete = typedName.trim() === teamName && (!isForfeiting || isForfeitAcknowledged);

  return (
    <>
      <DialogV2Header>
        <DialogV2Title>Delete {teamName}?</DialogV2Title>
        <DialogV2Description>
          Everyone in the team loses access to its projects, deployments, API keys and billing right away. Its saved cards are removed and auto reload is turned
          off. Its payment and deployment history is kept. This can&apos;t be undone.
        </DialogV2Description>
      </DialogV2Header>
      <DialogV2Body>
        <form
          id={formId}
          className="flex flex-col gap-4"
          onSubmit={event => {
            event.preventDefault();
            if (canDelete) onDelete(forfeitedBalanceUsd);
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
                I understand the team&apos;s remaining <UsdValue value={forfeitedBalanceUsd} /> in credits won&apos;t be refunded.
              </label>
            </div>
          )}
          <Input
            label={
              <>
                Type <span className="font-semibold">{teamName}</span> to confirm
              </>
            }
            autoComplete="off"
            value={typedName}
            onChange={event => setTypedName(event.target.value)}
            disabled={isDeleting}
          />
          {hasFailed && <Alert variant="destructive">We couldn&apos;t delete the team. Please try again.</Alert>}
        </form>
      </DialogV2Body>
      <DialogV2Footer className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" disabled={isDeleting} onClick={onCancel}>
          Cancel
        </Button>
        <LoadingButton type="submit" form={formId} variant="destructive" loading={isDeleting} disabled={!canDelete}>
          Delete team
        </LoadingButton>
      </DialogV2Footer>
    </>
  );
};
