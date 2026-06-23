import type { FC } from "react";

import { ImageRuntimeCard } from "../ImageRuntimeCard/ImageRuntimeCard";

export const DEPENDENCIES = { ImageRuntimeCard };

type Props = {
  serviceIndex: number;
  dependencies?: typeof DEPENDENCIES;
};

/**
 * The "ADDITIONAL" section of the Configuration pane for the selected service:
 * the runtime-facing cards that aren't hardware sizing. Each card edits the
 * shared deployment model for `services.${serviceIndex}` directly.
 */
export const AdditionalSection: FC<Props> = ({ serviceIndex, dependencies: d = DEPENDENCIES }) => {
  return (
    <div className="flex flex-col gap-2 px-4">
      <p className="font-mono text-xs uppercase text-muted-foreground">Additional</p>
      <div className="flex flex-col gap-4">
        <d.ImageRuntimeCard serviceIndex={serviceIndex} />
      </div>
    </div>
  );
};
