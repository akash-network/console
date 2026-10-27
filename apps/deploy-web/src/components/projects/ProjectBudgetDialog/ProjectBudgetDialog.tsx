"use client";
import type { FormEvent } from "react";
import { useId, useState } from "react";
import { extractApiErrorCode, isApiError } from "@akashnetwork/openapi-sdk";
import {
  Button,
  DialogV2,
  DialogV2Body,
  DialogV2Content,
  DialogV2Description,
  DialogV2Footer,
  DialogV2Header,
  DialogV2Title,
  Input,
  Label,
  LoadingButton,
  Snackbar,
  Switch
} from "@akashnetwork/ui/components";
import { useSnackbar } from "notistack";

import { useActiveOrganization } from "@src/context/OrganizationProvider/OrganizationProvider";
import { useCreateProjectBudgetMutation, useDeleteProjectBudgetMutation, useUpdateProjectBudgetMutation } from "@src/queries/useProjectBudgetQueries";
import type { ProjectBudget, ProjectBudgetSettings } from "@src/types/project-budget";
import { DEFAULT_ALERT_THRESHOLD_PERCENT, MAX_MONTHLY_BUDGET_USD, MIN_MONTHLY_BUDGET_USD } from "@src/types/project-budget";
import { formatSpendUsd } from "../projectSpend";

export const DEPENDENCIES = {
  useCreateProjectBudgetMutation,
  useUpdateProjectBudgetMutation,
  useDeleteProjectBudgetMutation,
  useSnackbar,
  useActiveOrganization
};

const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;
const PERCENT_PATTERN = /^\d+$/;
const BUDGET_EXISTS_ERROR_CODE = "project_budget_exists";
const FORBIDDEN_STATUS = 403;

interface Props {
  projectId: string;
  projectName: string;
  /** The budget being changed, or null to set the project's first one. */
  budget: ProjectBudget | null;
  onClose: () => void;
  dependencies?: typeof DEPENDENCIES;
}

export function ProjectBudgetDialog({ projectId, projectName, budget, onClose, dependencies: d = DEPENDENCIES }: Props) {
  const formId = useId();
  const amountId = useId();
  const thresholdId = useId();
  const stopTopUpsId = useId();
  const { enqueueSnackbar } = d.useSnackbar();
  const createBudget = d.useCreateProjectBudgetMutation();
  const updateBudget = d.useUpdateProjectBudgetMutation();
  const deleteBudget = d.useDeleteProjectBudgetMutation();
  const { activeOrganization } = d.useActiveOrganization();
  const alertRecipients = activeOrganization?.type === "personal" ? "You get" : "Owners and admins get";
  const [amount, setAmount] = useState(budget ? String(budget.monthlyAmountUsd) : "");
  const [threshold, setThreshold] = useState(String(budget?.alertThresholdPercent ?? DEFAULT_ALERT_THRESHOLD_PERCENT));
  const [stopTopUps, setStopTopUps] = useState(budget?.stopTopUps ?? false);
  const [hasTriedSaving, setHasTriedSaving] = useState(false);

  const isBusy = createBudget.isPending || updateBudget.isPending || deleteBudget.isPending;
  const monthlyAmountUsd = parseMonthlyAmount(amount);
  const alertThresholdPercent = parseThreshold(threshold);
  const showAmountError = hasTriedSaving && monthlyAmountUsd === null;
  const showThresholdError = hasTriedSaving && alertThresholdPercent === null;

  const notifyFailure = (title: string, error: unknown) => {
    const subTitle = isApiError(error) && error.status === FORBIDDEN_STATUS ? "Only owners and admins can change budgets." : "Try again in a moment.";
    enqueueSnackbar(<Snackbar title={title} subTitle={subTitle} iconVariant="error" />, { variant: "error" });
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setHasTriedSaving(true);
    if (monthlyAmountUsd === null || alertThresholdPercent === null || isBusy) return;

    const settings: ProjectBudgetSettings = { monthlyAmountUsd, alertThresholdPercent, stopTopUps };
    try {
      if (budget) {
        await updateBudget.mutateAsync({ id: budget.id, data: settings });
      } else {
        await createBudget.mutateAsync({ data: { projectId, ...settings } });
      }
      enqueueSnackbar(<Snackbar title={`Saved the budget for ${projectName}`} iconVariant="success" />, { variant: "success" });
      onClose();
    } catch (error) {
      if (extractApiErrorCode(error) === BUDGET_EXISTS_ERROR_CODE) {
        enqueueSnackbar(
          <Snackbar title={`${projectName} already has a budget`} subTitle="Edit the budget shown on the project instead." iconVariant="warning" />,
          {
            variant: "warning"
          }
        );
        onClose();
        return;
      }
      notifyFailure("Couldn't save the budget", error);
    }
  };

  const remove = async () => {
    if (!budget || isBusy) return;

    try {
      await deleteBudget.mutateAsync({ id: budget.id });
      enqueueSnackbar(<Snackbar title={`Removed the budget for ${projectName}`} iconVariant="success" />, { variant: "success" });
      onClose();
    } catch (error) {
      notifyFailure("Couldn't remove the budget", error);
    }
  };

  return (
    <DialogV2 open onOpenChange={isOpen => (!isOpen && !isBusy ? onClose() : undefined)}>
      <DialogV2Content className="max-w-[480px]" hideCloseButton={isBusy}>
        <DialogV2Header>
          <DialogV2Title>{budget ? "Edit monthly budget" : "Set a monthly budget"}</DialogV2Title>
          <DialogV2Description>
            New deployments in {projectName} are refused once this month&apos;s deposits would pass the budget. It doesn&apos;t set money aside for the project
            or cap what running deployments use.
          </DialogV2Description>
        </DialogV2Header>

        <DialogV2Body>
          <form id={formId} className="flex flex-col gap-5" noValidate onSubmit={save}>
            <div className="space-y-1.5">
              <Label htmlFor={amountId} className="text-[13px]">
                Monthly budget (USD)
              </Label>
              <Input
                id={amountId}
                inputMode="decimal"
                value={amount}
                placeholder="500"
                autoFocus
                error={showAmountError}
                aria-invalid={showAmountError}
                aria-describedby={`${amountId}-hint`}
                startIcon={<span className="pl-3 text-sm text-muted-foreground">$</span>}
                onChange={event => setAmount(event.target.value.trim())}
              />
              <p id={`${amountId}-hint`} className={showAmountError ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
                {showAmountError
                  ? `Enter an amount from ${formatSpendUsd(MIN_MONTHLY_BUDGET_USD)} to ${formatSpendUsd(MAX_MONTHLY_BUDGET_USD)}, in whole cents.`
                  : "Counted per calendar month in UTC."}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={thresholdId} className="text-[13px]">
                Alert threshold (%)
              </Label>
              <Input
                id={thresholdId}
                inputMode="numeric"
                value={threshold}
                error={showThresholdError}
                aria-invalid={showThresholdError}
                aria-describedby={`${thresholdId}-hint`}
                onChange={event => setThreshold(event.target.value.trim())}
              />
              <p id={`${thresholdId}-hint`} className={showThresholdError ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
                {showThresholdError
                  ? "Enter a whole percentage from 1 to 100."
                  : `${alertRecipients} an email once this month's deposits reach this share of the budget.`}
              </p>
            </div>

            <div className="flex items-start justify-between gap-4 rounded-lg border border-border px-3.5 py-3">
              <div className="space-y-1">
                <Label htmlFor={stopTopUpsId} className="text-[13px]">
                  Stop funding running deployments at the budget
                </Label>
                <p id={`${stopTopUpsId}-hint`} className="text-xs text-muted-foreground">
                  Running deployments in this project normally stay funded past the budget. Turn this on to cut them off at the budget too, so they can run out
                  of funds and close.
                </p>
              </div>
              <Switch id={stopTopUpsId} checked={stopTopUps} aria-describedby={`${stopTopUpsId}-hint`} onCheckedChange={setStopTopUps} />
            </div>
          </form>
        </DialogV2Body>

        <DialogV2Footer className="flex items-center gap-2">
          {budget && (
            <LoadingButton
              type="button"
              variant="ghost"
              className="mr-auto text-destructive"
              loading={deleteBudget.isPending}
              disabled={isBusy}
              onClick={remove}
            >
              Remove budget
            </LoadingButton>
          )}
          <Button type="button" variant="ghost" className={budget ? undefined : "ml-auto"} disabled={isBusy} onClick={onClose}>
            Cancel
          </Button>
          <LoadingButton type="submit" form={formId} loading={createBudget.isPending || updateBudget.isPending} disabled={isBusy}>
            Save budget
          </LoadingButton>
        </DialogV2Footer>
      </DialogV2Content>
    </DialogV2>
  );
}

function parseMonthlyAmount(value: string): number | null {
  if (!AMOUNT_PATTERN.test(value)) return null;
  const amount = Number(value);
  return amount >= MIN_MONTHLY_BUDGET_USD && amount <= MAX_MONTHLY_BUDGET_USD ? amount : null;
}

function parseThreshold(value: string): number | null {
  if (!PERCENT_PATTERN.test(value)) return null;
  const percent = Number(value);
  return percent >= 1 && percent <= 100 ? percent : null;
}
