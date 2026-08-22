import type { ChangeEvent, FC } from "react";
import { CustomTooltip, Input } from "@akashnetwork/ui/components";
import { InfoCircle } from "iconoir-react";

import { useFlag } from "@src/hooks/useFlag";
import { useTrialGate } from "../../ConfigurationPane/HardwareSection/useTrialGate/useTrialGate";

export const DEPENDENCIES = { useFlag, useTrialGate };

/** Mirrors the API's `runtimeLimitHours` bound of one year. */
export const MAX_RUNTIME_LIMIT_HOURS = 8760;

type Props = {
  /** The requested runtime limit in hours; undefined means no limit (always-on funding). */
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  /** While the pane is locked the control is disabled so it can't be edited while quotes are active. */
  locked?: boolean;
  dependencies?: typeof DEPENDENCIES;
};

/**
 * Optional runtime limit for the deployment, in whole hours. Hidden entirely behind its feature flag and
 * for trial users — trial deployments are never auto-funded, so a limit would be meaningless there. Left
 * empty (the default), nothing changes: automatic funding stays on with no visible toggle.
 */
export const RuntimeLimitSection: FC<Props> = ({ value, onChange, locked = false, dependencies: d = DEPENDENCIES }) => {
  const isEnabled = d.useFlag("deployment_runtime_limit");
  const { isRestricted } = d.useTrialGate();

  if (!isEnabled || isRestricted) {
    return null;
  }

  const applyRuntimeLimitInput = (event: ChangeEvent<HTMLInputElement>) => {
    const hours = Math.floor(Number(event.target.value));
    onChange(hours >= 1 ? Math.min(hours, MAX_RUNTIME_LIMIT_HOURS) : undefined);
  };

  return (
    <fieldset disabled={locked} className="m-0 min-w-0 space-y-2 border-0 p-0">
      <div className="flex items-center gap-2 px-1 font-mono text-xs uppercase text-muted-foreground">
        Runtime limit
        <CustomTooltip
          className="max-w-[260px] p-3 font-sans text-xs normal-case text-muted-foreground"
          title={
            <>
              <strong>Runtime limit</strong>
              <br />
              <br />
              Run the deployment for a fixed number of hours, counted from when it starts. Once the limit is reached it stops being funded and closes.
              <br />
              <br />
              Leave empty to keep it running as long as your account has credits.
            </>
          }
        >
          <InfoCircle className="h-3.5 w-3.5" />
        </CustomTooltip>
      </div>
      <Input
        type="number"
        aria-label="Runtime limit in hours"
        placeholder="No limit"
        min={1}
        max={MAX_RUNTIME_LIMIT_HOURS}
        step={1}
        disabled={locked}
        value={value ?? ""}
        onChange={applyRuntimeLimitInput}
        endIcon={<span className="pr-2 text-xs text-muted-foreground">hours</span>}
        inputClassName="h-9 text-xs"
      />
    </fieldset>
  );
};
