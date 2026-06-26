import type { FC } from "react";

import { CommandsCard } from "../CommandsCard/CommandsCard";
import { EnvironmentVariablesCard } from "../EnvironmentVariablesCard/EnvironmentVariablesCard";
import { ImageRuntimeCard } from "../ImageRuntimeCard/ImageRuntimeCard";

export const DEPENDENCIES = { ImageRuntimeCard, EnvironmentVariablesCard, CommandsCard };

type Props = {
  serviceIndex: number;
  /** While the pane is locked the additional cards are disabled (their chevrons stay expandable for viewing). */
  locked?: boolean;
  dependencies?: typeof DEPENDENCIES;
};

/**
 * The "ADDITIONAL" section of the Configuration pane for the selected service:
 * the runtime-facing cards that aren't hardware sizing. Each card edits the
 * shared deployment model for `services.${serviceIndex}` directly.
 */
export const AdditionalSection: FC<Props> = ({ serviceIndex, locked = false, dependencies: d = DEPENDENCIES }) => {
  return (
    <div className="flex flex-col gap-2 px-4">
      <p className="font-mono text-xs uppercase text-muted-foreground">Additional</p>
      <div className="flex flex-col gap-4">
        <d.ImageRuntimeCard serviceIndex={serviceIndex} locked={locked} />

        <d.EnvironmentVariablesCard serviceIndex={serviceIndex} locked={locked} />

        <d.CommandsCard serviceIndex={serviceIndex} locked={locked} />
      </div>
    </div>
  );
};
