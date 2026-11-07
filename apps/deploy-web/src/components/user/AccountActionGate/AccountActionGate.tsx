"use client";
import type { MouseEvent, ReactElement } from "react";
import { cloneElement } from "react";
import { CustomTooltip } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";

import { useAccountStatus } from "@src/hooks/useAccountStatus/useAccountStatus";

export const DEPENDENCIES = { useAccountStatus, CustomTooltip };

const SUSPENDED_EXPLANATION = "Your account is suspended, so you can't deploy or add funds.";
const TERMINATED_EXPLANATION = "Your account has been terminated, so you can't make changes.";

type GatedControl = ReactElement<{
  disabled?: boolean;
  className?: string;
  tabIndex?: number;
  "aria-disabled"?: boolean | "true" | "false";
  onClick?: (event: MouseEvent<HTMLElement>) => void;
}>;

type Props = {
  children: GatedControl;
  dependencies?: typeof DEPENDENCIES;
};

/** Gates a control that deploys or adds funds, which a suspended or terminated account may no longer do. */
export function AccountSpendGate({ children, dependencies: d = DEPENDENCIES }: Props) {
  const { canSpend, isTerminated } = d.useAccountStatus();

  return (
    <RestrictedControl isAllowed={canSpend} isTerminated={isTerminated} CustomTooltip={d.CustomTooltip}>
      {children}
    </RestrictedControl>
  );
}

/** Gates a control that changes anything, which only a terminated account may no longer do. */
export function AccountMutationGate({ children, dependencies: d = DEPENDENCIES }: Props) {
  const { canMutate, isTerminated } = d.useAccountStatus();

  return (
    <RestrictedControl isAllowed={canMutate} isTerminated={isTerminated} CustomTooltip={d.CustomTooltip}>
      {children}
    </RestrictedControl>
  );
}

type RestrictedControlProps = {
  isAllowed: boolean;
  isTerminated: boolean;
  CustomTooltip: typeof DEPENDENCIES.CustomTooltip;
  children: GatedControl;
};

/** The wrapper span keeps the explanation reachable, since a disabled control gets no pointer events. */
function RestrictedControl({ isAllowed, isTerminated, CustomTooltip, children }: RestrictedControlProps) {
  if (isAllowed) return children;

  return (
    <CustomTooltip title={isTerminated ? TERMINATED_EXPLANATION : SUSPENDED_EXPLANATION}>
      <span tabIndex={0} className="inline-flex cursor-not-allowed">
        {disable(children)}
      </span>
    </CustomTooltip>
  );
}

/** A link has no disabled state, so it also loses its pointer events, its tab stop and its navigation. */
function disable(control: GatedControl) {
  return cloneElement(control, {
    disabled: true,
    "aria-disabled": true,
    tabIndex: -1,
    className: cn(control.props.className, "pointer-events-none opacity-50"),
    onClick: preventActivation
  });
}

function preventActivation(event: MouseEvent<HTMLElement>) {
  event.preventDefault();
}
