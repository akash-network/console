import type { FC } from "react";

import { CommandsCard } from "../CommandsCard/CommandsCard";
import { EnvironmentVariablesCard } from "../EnvironmentVariablesCard/EnvironmentVariablesCard";
import { ExposePortsCard } from "../ExposePortsCard/ExposePortsCard";
import { LogsCard } from "../LogsCard/LogsCard";
import { RuntimeCard } from "../RuntimeCard/RuntimeCard";

export const DEPENDENCIES = { RuntimeCard, EnvironmentVariablesCard, CommandsCard, ExposePortsCard, LogsCard };

type Props = {
  serviceIndex: number;
  /** Locks the runtime, ports and logs cards. The env vars and commands cards are manifest-only and stay editable. */
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
        <d.RuntimeCard serviceIndex={serviceIndex} locked={locked} />

        <d.EnvironmentVariablesCard serviceIndex={serviceIndex} />

        <d.CommandsCard serviceIndex={serviceIndex} />

        <d.ExposePortsCard serviceIndex={serviceIndex} locked={locked} />

        <d.LogsCard serviceIndex={serviceIndex} locked={locked} />
      </div>
    </div>
  );
};
