import type { FC } from "react";
import { CollapsibleCard } from "@akashnetwork/ui/components";
import { ShieldCheckIcon } from "lucide-react";

import { confidentialComputeTooltip } from "../cardTooltips";
import { ConfidentialComputeFields } from "../ConfidentialComputeFields/ConfidentialComputeFields";
import { useConfidentialCompute } from "../useConfidentialCompute/useConfidentialCompute";

export const DEPENDENCIES = { CollapsibleCard, ConfidentialComputeFields };

type Props = {
  serviceIndex: number;
  locked?: boolean;
  isGpuBlocked?: boolean;
  onUnlock?: () => void;
  dependencies?: typeof DEPENDENCIES;
};

/** An open, switched-off card is only reachable while the pane is locked, since the header switch alone turns confidential compute on. */
export const SecurityCard: FC<Props> = ({ serviceIndex, locked = false, isGpuBlocked, onUnlock, dependencies: d = DEPENDENCIES }) => {
  const { isEnabled, setEnabled } = useConfidentialCompute(serviceIndex, { isGpuBlocked });

  return (
    <d.CollapsibleCard
      locked={locked}
      title="Confidential compute"
      icon={<ShieldCheckIcon className="h-4 w-4" />}
      infoTooltip={confidentialComputeTooltip}
      isToggled={isEnabled}
      onToggle={setEnabled}
      toggleAriaLabel="Enable confidential compute"
      toggleDisabled={locked}
    >
      {isEnabled ? (
        <d.ConfidentialComputeFields serviceIndex={serviceIndex} locked={locked} isGpuBlocked={isGpuBlocked} onUnlock={onUnlock} />
      ) : (
        <p className="text-sm text-muted-foreground">Confidential compute is off.</p>
      )}
    </d.CollapsibleCard>
  );
};
