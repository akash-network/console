"use client";
import type { ComponentProps, FC } from "react";
import { useRef } from "react";
import {
  Button,
  DialogV2,
  DialogV2Body,
  DialogV2Content,
  DialogV2Description,
  DialogV2Footer,
  DialogV2Header,
  DialogV2Title,
  Snackbar,
  Spinner
} from "@akashnetwork/ui/components";
import { ArrowRight, Rocket } from "iconoir-react";
import { useSnackbar } from "notistack";

import { PricePerTimeUnit } from "@src/components/shared/PricePerTimeUnit";
import { useFlag } from "@src/hooks/useFlag";
import { useUpdateDeploymentSettingMutation } from "@src/queries/deploymentSettingsQuery";
import type { AppError, PlacementType } from "@src/types";
import { extractErrorMessage } from "@src/utils/errorUtils";
import { PRICE_DISPLAY_PRECISION, udenomToDenom } from "@src/utils/mathHelpers";
import { useTrialGate } from "../ConfigurationPane/HardwareSection/useTrialGate/useTrialGate";
import { useDeploymentHasGpu } from "../DeploymentResourceSummary/useDeploymentResourceSummary";
import { RuntimeLimitReviewSection } from "./RuntimeLimitReviewSection";
import type { ReviewRow } from "./useReviewRows";
import { useReviewRows } from "./useReviewRows";

export const DEPENDENCIES = {
  useReviewRows,
  PricePerTimeUnit,
  useDeploymentHasGpu,
  RuntimeLimitReviewSection,
  useFlag,
  useTrialGate,
  useUpdateDeploymentSettingMutation,
  useSnackbar,
  Snackbar
};

interface Props {
  open: boolean;
  dseq: string | null;
  placements: PlacementType[];
  selections: Record<string, string>;
  /** The requested runtime limit in hours; undefined means no limit. Owned by the form so it survives a draft reload. */
  runtimeLimitHours: number | undefined;
  onRuntimeLimitHoursChange: (value: number | undefined) => void;
  onConfirm: () => void;
  onBack: () => void;
  dependencies?: typeof DEPENDENCIES;
}

/**
 * Built on DialogV2 (the bordered header/body/footer chrome) so it reads as a sibling of the
 * other configure-flow modals (LogsCard, ExposePortsCard, …) rather than a one-off.
 */
export const ReviewAndDeployModal: FC<Props> = ({
  open,
  dseq,
  placements,
  selections,
  runtimeLimitHours,
  onRuntimeLimitHoursChange,
  onConfirm,
  onBack,
  dependencies: d = DEPENDENCIES
}) => {
  const { rows, pricedCount, totalCount } = d.useReviewRows({ dseq, placements, selections });
  /** Match the marketplace's cost unit: hourly for GPU (meaningful at that scale), monthly for CPU-only (so a cheap deployment reads as e.g. `$30/month` rather than rounding to `$0.00/hr`). */
  const showAsHourly = d.useDeploymentHasGpu();
  const { enqueueSnackbar } = d.useSnackbar();
  const updateSetting = d.useUpdateDeploymentSettingMutation({ dseq: dseq ?? "" });
  /**
   * Runtime limits sit behind a flag, and mean nothing for trial users whose deployments are never
   * auto-funded. Gating the submitted value too, not just the control, keeps a draft saved while the flag
   * was on from silently applying a limit after it is turned off.
   */
  const isRuntimeLimitEnabled = d.useFlag("deployment_runtime_limit");
  const { isRestricted } = d.useTrialGate();
  const isRuntimeLimitOffered = isRuntimeLimitEnabled && !isRestricted;
  const effectiveRuntimeLimitHours = isRuntimeLimitOffered && runtimeLimitHours ? runtimeLimitHours : undefined;
  /** Only deployable once every placement is selected and still has a live (priced) bid — a closed/stale bid leaves a row unpriced and would fail at create-lease. */
  const canConfirm = totalCount > 0 && rows.length === totalCount && pricedCount === totalCount;
  const preventDefault = (e: Event) => e.preventDefault();

  /** What an earlier confirm already wrote for this dseq, so a retry can reconcile against it. */
  const committedRuntimeLimitRef = useRef<{ dseq: string; hours: number } | null>(null);

  /**
   * The limit is stored on the deployment before any lease exists, so the countdown can anchor at lease
   * start. A failed patch blocks the deploy rather than deploying without the limit the user asked for:
   * the deployment would then run unbounded, which is the opposite of what they chose.
   *
   * A failed deploy drops back to the marketplace on the same deployment, so a second confirm reconciles
   * what the first one wrote: the API only ever raises a limit, so turning one off or lowering it is a
   * removal followed by the new value.
   */
  const confirmAndDeploy = async () => {
    const committed = committedRuntimeLimitRef.current?.dseq === dseq ? committedRuntimeLimitRef.current.hours : undefined;

    if (dseq && committed !== effectiveRuntimeLimitHours) {
      try {
        if (committed !== undefined && (effectiveRuntimeLimitHours === undefined || effectiveRuntimeLimitHours < committed)) {
          await updateSetting.mutateAsync({ runtimeLimitHours: null });
          committedRuntimeLimitRef.current = null;
        }

        if (effectiveRuntimeLimitHours !== undefined) {
          await updateSetting.mutateAsync({ runtimeLimitHours: effectiveRuntimeLimitHours });
          committedRuntimeLimitRef.current = { dseq, hours: effectiveRuntimeLimitHours };
        }
      } catch (error) {
        enqueueSnackbar(<d.Snackbar title="Couldn't set the runtime limit" subTitle={extractErrorMessage(error as AppError)} iconVariant="error" />, {
          variant: "error"
        });
        return;
      }
    }

    onConfirm();
  };

  return (
    <DialogV2 open={open} onOpenChange={isOpen => (!isOpen ? onBack() : undefined)}>
      <DialogV2Content className="max-w-2xl" onEscapeKeyDown={preventDefault} onInteractOutside={preventDefault} hideCloseButton>
        <DialogV2Header>
          <DialogV2Title>Review and deploy</DialogV2Title>
          <DialogV2Description>Review your provider selections for each placement before deploying.</DialogV2Description>
        </DialogV2Header>

        <DialogV2Body className="space-y-4">
          <ul className="divide-y">
            {rows.map((row, index) => (
              <li key={row.placementId} className="flex items-center gap-4 py-4 first:pt-0">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs text-muted-foreground">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">Placement</p>
                  <p className="truncate text-sm">{row.region ? `${row.placementName} · ${row.region}` : row.placementName}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">Provider</p>
                  <p className="truncate text-sm">{row.providerName}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">Price</p>
                  {row.price ? (
                    <d.PricePerTimeUnit
                      denom={row.price.denom}
                      perBlockValue={udenomToDenom(row.price.amount, PRICE_DISPLAY_PRECISION)}
                      showAsHourly={showAsHourly}
                      abbreviated
                    />
                  ) : (
                    <span>—</span>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between rounded-lg border bg-muted p-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">Total deployment cost</p>
              <p className="text-xs text-muted-foreground">
                {pricedCount} of {totalCount} {totalCount === 1 ? "placement" : "placements"} priced
              </p>
            </div>
            <TotalPrice rows={rows} showAsHourly={showAsHourly} PricePerTimeUnit={d.PricePerTimeUnit} />
          </div>

          {isRuntimeLimitOffered && <d.RuntimeLimitReviewSection value={runtimeLimitHours} onChange={onRuntimeLimitHoursChange} rows={rows} />}
        </DialogV2Body>

        <DialogV2Footer>
          <Button variant="ghost" onClick={onBack} disabled={updateSetting.isPending}>
            Back to marketplace
          </Button>
          <Button onClick={confirmAndDeploy} className="gap-2" disabled={!canConfirm || updateSetting.isPending}>
            Confirm and deploy
            {updateSetting.isPending ? <Spinner size="small" /> : <Rocket className="h-4 w-4" />}
          </Button>
        </DialogV2Footer>
      </DialogV2Content>
    </DialogV2>
  );
};

/**
 * Sums the selected offers' per-block prices and renders the USD total through the shared price component,
 * hourly for GPU deployments and monthly for CPU-only ones to match the per-placement rows. Assumes a single
 * denom across placements (one deployment shares a deposit denom), so it labels the sum with the first priced
 * row's denom; mixed denoms are not expected in this flow.
 */
function TotalPrice({
  rows,
  showAsHourly,
  PricePerTimeUnit: Price
}: {
  rows: ReviewRow[];
  showAsHourly: boolean;
  PricePerTimeUnit: FC<ComponentProps<typeof PricePerTimeUnit>>;
}) {
  const priced = rows.filter((r): r is ReviewRow & { price: { amount: string; denom: string } } => !!r.price);
  if (priced.length === 0) return <span className="text-2xl font-bold">—</span>;
  const denom = priced[0].price.denom;
  const perBlockTotal = priced.reduce((sum, r) => sum + udenomToDenom(r.price.amount, PRICE_DISPLAY_PRECISION), 0);
  return <Price denom={denom} perBlockValue={perBlockTotal} showAsHourly={showAsHourly} abbreviated className="text-2xl font-bold" />;
}
