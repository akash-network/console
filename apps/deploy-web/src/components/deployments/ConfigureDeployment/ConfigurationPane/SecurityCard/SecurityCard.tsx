import type { FC } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { CollapsibleCard } from "@akashnetwork/ui/components";
import { ShieldCheckIcon } from "lucide-react";

import type { SdlBuilderFormValuesType } from "@src/types";
import type { TeeType } from "@src/utils/confidentialCompute";
import { formatTeeTypeLabel } from "@src/utils/confidentialCompute";
import { confidentialComputeTooltip } from "../cardTooltips";
import { ConfidentialComputeFields } from "../ConfidentialComputeFields/ConfidentialComputeFields";

export const DEPENDENCIES = { CollapsibleCard, ConfidentialComputeFields };

type Props = {
  serviceIndex: number;
  locked?: boolean;
  isGpuBlocked?: boolean;
  onUnlock?: () => void;
  dependencies?: typeof DEPENDENCIES;
};

export const SecurityCard: FC<Props> = ({ serviceIndex, locked, isGpuBlocked, onUnlock, dependencies: d = DEPENDENCIES }) => {
  const { control } = useFormContext<SdlBuilderFormValuesType>();
  const tee = useWatch({ control, name: `services.${serviceIndex}.params.tee` });

  return (
    <d.CollapsibleCard
      locked={locked}
      title="Security"
      icon={<ShieldCheckIcon className="h-4 w-4" />}
      infoTooltip={confidentialComputeTooltip}
      summary={summarizeSecurity(tee)}
    >
      <d.ConfidentialComputeFields serviceIndex={serviceIndex} locked={locked} isGpuBlocked={isGpuBlocked} onUnlock={onUnlock} />
    </d.CollapsibleCard>
  );
};

function summarizeSecurity(tee: TeeType | undefined) {
  return tee ? `Confidential compute (${formatTeeTypeLabel(tee)})` : "Off";
}
