import type { FC, ReactNode } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Button, Snackbar } from "@akashnetwork/ui/components";
import { Send } from "iconoir-react";
import { LoaderCircle } from "lucide-react";
import { useSnackbar } from "notistack";

import { PriceValue } from "@src/components/shared/PriceValue";
import type { SdlBuilderFormValuesType } from "@src/types";
import { perBlockToHourly } from "@src/utils/priceUtils";
import { generateSdl } from "@src/utils/sdl/sdlGenerator";
import { validateGeneratedSdl } from "@src/utils/sdl/validateGeneratedSdl";
import { useDeploymentResourceSummary } from "../DeploymentResourceSummary/useDeploymentResourceSummary";
import type { DeploymentCost } from "../useDeploymentCost/useDeploymentCost";
import { useDeploymentCost } from "../useDeploymentCost/useDeploymentCost";
import type { DeploymentFlow } from "../useDeploymentFlow/useDeploymentFlow";

export const DEPENDENCIES = { useDeploymentResourceSummary, useSnackbar, Snackbar, generateSdl, validateGeneratedSdl, useDeploymentCost, PriceValue };

type Props = { flow: DeploymentFlow; sdl: string; onDeploy: () => void; allPlacementsHaveBids: boolean; dependencies?: typeof DEPENDENCIES };

export const ConfigureDeploymentHeader: FC<Props> = ({ flow, sdl, onDeploy, allPlacementsHaveBids, dependencies: d = DEPENDENCIES }) => {
  const deploymentSummary = d.useDeploymentResourceSummary();
  const { control, handleSubmit, getValues } = useFormContext<SdlBuilderFormValuesType>();
  const { enqueueSnackbar } = d.useSnackbar();
  const placements = useWatch({ control, name: "placements" });
  const cost = d.useDeploymentCost({ dseq: flow.dseq, sdl, placements, selections: flow.selections });

  const isEditable = flow.phase === "configuring" || flow.phase === "error";
  /** Deploy only takes over from the loading CTA once every placement has bids; until then quoting still reads as "Requesting…". */
  const showDeployCta = flow.phase === "quoting" && allPlacementsHaveBids;
  const allPlacementsSelected = placements.length > 0 && placements.every(placement => !!flow.selections[placement.id]);
  /** A failed deploy returns to quoting with the error set; the CTA then re-fires the same request rather than re-opening review. */
  const hasDeployError = !!flow.deployError;

  /**
   * Request quotes runs the zod form validation first, then regenerates the SDL from the values
   * `handleSubmit` just accepted — not a prop snapshot, which lags behind in-flight edits — and runs the
   * chain-sdk SDL validator on it. That validator catches semantic rules the form can't, such as a `cpu-gpu`
   * confidential-compute service missing GPU resources or conflicting TEE types across a placement group.
   * Either failure surfaces the errors to the user; otherwise the same freshly generated SDL is what gets
   * submitted, so validation and creation can never disagree about which spec they acted on.
   */
  const onRequestQuotes = handleSubmit(values => {
    const sdl = d.generateSdl(values);
    const errors = d.validateGeneratedSdl(sdl);
    if (errors.length > 0) {
      enqueueSnackbar(
        <d.Snackbar
          title="Your deployment can't be submitted yet"
          subTitle={
            <ul className="list-disc pl-4">
              {errors.map(error => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          }
          iconVariant="error"
        />,
        { variant: "error" }
      );
      return;
    }
    flow.actions.requestQuotes(sdl);
  });

  return (
    <header className="flex flex-row items-center justify-between gap-3 md:items-end">
      <div className="flex min-w-0 flex-1 flex-col gap-1 md:gap-2">
        <h1 className="text-xl font-bold leading-tight tracking-tight md:text-3xl md:leading-9">Configure your deployment</h1>
        <p className="hidden text-base text-muted-foreground md:block">
          Adjust your deployment spec to refine available providers in the compute marketplace. Request official quotes when you&apos;re ready.
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-3 md:gap-6">
        <DeploymentSummaryBlock label="Your deployment" value={deploymentSummary} />
        <div className="hidden h-12 w-px self-stretch bg-border md:block" aria-hidden="true" />
        <DeploymentSummaryBlock label="Deployment cost" value={<CostValue cost={cost} PriceValue={d.PriceValue} />} suffix={cost ? "/hr" : undefined} />
        {isEditable ? (
          <Button type="button" onClick={onRequestQuotes} className="h-9 shrink-0 px-3 md:h-10 md:px-8">
            <Send className="h-4 w-4 md:hidden" aria-label="Request quotes" />
            <span className="hidden md:inline">Request quotes</span>
          </Button>
        ) : showDeployCta ? (
          <Button
            type="button"
            disabled={!allPlacementsSelected}
            onClick={hasDeployError ? () => flow.actions.deploy(d.generateSdl(getValues())) : onDeploy}
            aria-label={hasDeployError ? "Retry" : "Deploy"}
            className="h-9 shrink-0 px-3 md:h-10 md:px-8"
          >
            {hasDeployError ? "Retry" : "Deploy"}
          </Button>
        ) : (
          <Button type="button" disabled aria-label="Requesting" className="h-9 shrink-0 gap-2 px-3 md:h-10 md:px-8">
            <LoaderCircle className="h-4 w-4 animate-spin text-current" aria-hidden="true" />
            <span className="hidden md:inline">Requesting…</span>
          </Button>
        )}
      </div>
    </header>
  );
};

interface DeploymentSummaryBlockProps {
  label: string;
  value: ReactNode;
  suffix?: string;
}

function DeploymentSummaryBlock({ label, value, suffix }: DeploymentSummaryBlockProps) {
  return (
    <div className="flex flex-col items-end">
      <span className="font-mono text-[10px] uppercase text-muted-foreground md:text-sm">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className="font-mono text-base font-semibold leading-tight md:text-xl md:leading-8">{value}</span>
        {suffix ? <span className="font-mono text-xs text-muted-foreground md:text-base">{suffix}</span> : null}
      </div>
    </div>
  );
}

interface CostValueProps {
  cost: DeploymentCost | null;
  PriceValue: typeof DEPENDENCIES.PriceValue;
}

/** The header cost value: a dash before bids, a single hourly USD price when the bounds are equal, otherwise a min–max range. */
function CostValue({ cost, PriceValue }: CostValueProps) {
  if (!cost) return <>—</>;
  if (cost.minPerBlock === cost.maxPerBlock) {
    return <PriceValue denom={cost.denom} value={perBlockToHourly(cost.minPerBlock)} />;
  }
  return (
    <>
      <PriceValue denom={cost.denom} value={perBlockToHourly(cost.minPerBlock)} /> -{" "}
      <PriceValue denom={cost.denom} value={perBlockToHourly(cost.maxPerBlock)} />
    </>
  );
}
