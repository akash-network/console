"use client";
import type { FC } from "react";
import { useCallback, useState } from "react";
import { Button, Snackbar, Spinner } from "@akashnetwork/ui/components";
import { usePopup } from "@akashnetwork/ui/context";
import { cn } from "@akashnetwork/ui/utils";
import { useSnackbar } from "notistack";

import { useServices } from "@src/context/ServicesProvider";
import { useDeploymentMetrics } from "@src/hooks/useDeploymentMetrics";
import { useHasDeploymentStopped } from "@src/hooks/useHasDeploymentStopped";
import { useTickingNow } from "@src/hooks/useTickingNow";
import { useDeploymentSettingQuery, useUpdateDeploymentSettingMutation } from "@src/queries/deploymentSettingsQuery";
import type { AppError } from "@src/types";
import type { DeploymentDto, LeaseDto } from "@src/types/deployment";
import { getEscrowDenom } from "@src/utils/deploymentUtils";
import { extractErrorMessage } from "@src/utils/errorUtils";
import { getRuntimeLimitCountdown } from "@src/utils/runtimeLimitUtils";
import { RuntimeLimitMeter } from "../RuntimeLimitMeter";
import { AddRuntimeHoursModal } from "./AddRuntimeHoursModal";

export const DEPENDENCIES = {
  useServices,
  usePopup,
  useDeploymentSettingQuery,
  useDeploymentMetrics,
  useUpdateDeploymentSettingMutation,
  useTickingNow,
  useSnackbar,
  Snackbar,
  AddRuntimeHoursModal
};

export interface DeploymentBillingSectionProps {
  deployment: DeploymentDto;
  leases: LeaseDto[] | null | undefined;
  onFundsChanged: () => void;
  dependencies?: typeof DEPENDENCIES;
}

export const DeploymentBillingSection: FC<DeploymentBillingSectionProps> = ({ deployment, leases, onFundsChanged, dependencies: d = DEPENDENCIES }) => {
  const { analyticsService } = d.useServices();
  const { confirm } = d.usePopup();
  const { enqueueSnackbar } = d.useSnackbar();
  const [isAddingHours, setIsAddingHours] = useState(false);
  const isActive = deployment.state === "active";

  const deploymentSetting = d.useDeploymentSettingQuery({ dseq: deployment.dseq, pollUntilRuntimeAnchored: true });
  const { deploymentCost: costPerBlockUdenom } = d.useDeploymentMetrics({ deployment, leases });
  const escrowDenom = getEscrowDenom(deployment);
  const updateSetting = d.useUpdateDeploymentSettingMutation({ dseq: deployment.dseq });

  const runtimeLimitHours = deploymentSetting.data?.runtimeLimitHours ?? null;
  const runtimeEndsAt = deploymentSetting.data?.runtimeEndsAt ?? null;
  const isRuntimeLimited = !!runtimeLimitHours;
  const hasStopped = useHasDeploymentStopped({ deployment, leases });
  const now = d.useTickingNow(!!runtimeEndsAt && !hasStopped);
  const runtimeLimitCountdown = runtimeLimitHours ? getRuntimeLimitCountdown({ runtimeLimitHours, runtimeEndsAt, hasStopped, now }) : null;

  const openAddHoursModal = useCallback(() => {
    setIsAddingHours(true);
    analyticsService.track("add_runtime_hours_btn_clk", "Amplitude");
  }, [analyticsService]);

  /**
   * Reloads the deployment on success because a new limit shifts the deadline the countdown reads, and
   * the extension is funded right away so the escrow balance moves too. The API's message is surfaced
   * verbatim: it is the one that explains which bound the request broke.
   */
  const submitAddedHours = useCallback(
    async (totalHours: number) => {
      try {
        await updateSetting.mutateAsync({ runtimeLimitHours: totalHours });
        setIsAddingHours(false);
        analyticsService.track("add_runtime_hours", { category: "deployments", label: "Extend runtime limit in deployment settings" });
        onFundsChanged();
      } catch (error) {
        enqueueSnackbar(<d.Snackbar title="Couldn't add runtime hours" subTitle={extractErrorMessage(error as AppError)} iconVariant="error" />, {
          variant: "error"
        });
      }
    },
    [analyticsService, d, enqueueSnackbar, onFundsChanged, updateSetting]
  );

  /**
   * Drops the runtime limit for good, so it asks first: the deployment then funds itself until the user
   * closes it, and nothing here offers a way back to a fixed runtime.
   */
  const switchToAlwaysOn = useCallback(async () => {
    analyticsService.track("remove_runtime_limit_btn_clk", "Amplitude");

    const isConfirmed = await confirm({
      title: "Switch to always on?",
      message: "This deployment will keep topping up automatically until you close it. You can't switch back to a fixed runtime."
    });

    if (!isConfirmed) return;

    try {
      await updateSetting.mutateAsync({ runtimeLimitHours: null });
      analyticsService.track("remove_runtime_limit", { category: "deployments", label: "Switch a limited deployment to always on" });
      onFundsChanged();
    } catch (error) {
      enqueueSnackbar(<d.Snackbar title="Couldn't switch to always on" subTitle={extractErrorMessage(error as AppError)} iconVariant="error" />, {
        variant: "error"
      });
    }
  }, [analyticsService, confirm, d, enqueueSnackbar, onFundsChanged, updateSetting]);

  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1 sm:max-w-sm">
          {runtimeLimitCountdown && (
            <div className="space-y-1.5 pt-1">
              <div className={cn("flex items-baseline gap-2", runtimeLimitCountdown.status !== "unanchored" && "justify-between")}>
                <span className="text-sm font-semibold">{runtimeLimitCountdown.remainingLabel}</span>
                <span className="text-xs text-muted-foreground">{runtimeLimitCountdown.captionLabel}</span>
              </div>
              <RuntimeLimitMeter countdown={runtimeLimitCountdown} />
            </div>
          )}
        </div>
        {isActive && isRuntimeLimited && (
          <Button variant="outline" size="md" onClick={openAddHoursModal}>
            Add hours
          </Button>
        )}
      </div>

      {isActive && isRuntimeLimited && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t pt-6">
          <div className="space-y-1">
            <div className="font-medium">Runtime limit</div>
            <p className="text-sm text-muted-foreground">
              This deployment closes automatically once its limit is reached. Switching to always on keeps it funded until you close it, and can&apos;t be
              undone.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {updateSetting.isPending && <Spinner size="small" />}
            <Button variant="outline" size="md" onClick={switchToAlwaysOn} disabled={updateSetting.isPending}>
              Switch to always on
            </Button>
          </div>
        </div>
      )}

      {isAddingHours && isRuntimeLimited && (
        <d.AddRuntimeHoursModal
          currentLimitHours={runtimeLimitHours}
          costPerBlockUdenom={costPerBlockUdenom}
          denom={escrowDenom}
          isSubmitting={updateSetting.isPending}
          onCancel={() => setIsAddingHours(false)}
          onSubmit={submitAddedHours}
        />
      )}
    </div>
  );
};
