import type { FC } from "react";
import { useFormContext, useWatch } from "react-hook-form";

import type { SdlBuilderFormValuesType } from "@src/types";
import { isVmImage } from "@src/utils/sdl/vmImages";
import { CommandsCard } from "../CommandsCard/CommandsCard";
import type { ConfigurationLock } from "../configurationLock";
import { EnvironmentVariablesCard } from "../EnvironmentVariablesCard/EnvironmentVariablesCard";
import { ExposePortsCard } from "../ExposePortsCard/ExposePortsCard";
import { LogsCard } from "../LogsCard/LogsCard";
import { RuntimeCard } from "../RuntimeCard/RuntimeCard";

export const DEPENDENCIES = { RuntimeCard, EnvironmentVariablesCard, CommandsCard, ExposePortsCard, LogsCard };

type Props = {
  serviceIndex: number;
  /**
   * How much of the section is locked. The runtime, ports and logs cards lock as soon as the deployment is on-chain;
   * the manifest-only env-var and command cards lock only under a full `"all"` lock (create/close/deploy).
   */
  locked?: ConfigurationLock;
  dependencies?: typeof DEPENDENCIES;
};

/**
 * The "ADDITIONAL" section of the Configuration pane for the selected service:
 * the runtime-facing cards that aren't hardware sizing. Each card edits the
 * shared deployment model for `services.${serviceIndex}` directly.
 *
 * A managed SSH-VM service gets no Commands card: overriding the entrypoint would break the SSH
 * bootstrap that installs the public key and starts sshd (the legacy builder hid it the same way).
 */
export const AdditionalSection: FC<Props> = ({ serviceIndex, locked, dependencies: d = DEPENDENCIES }) => {
  const structuralLocked = !!locked;
  const manifestLocked = locked === "all";
  const { control } = useFormContext<SdlBuilderFormValuesType>();
  const image = useWatch({ control, name: `services.${serviceIndex}.image` });
  const isVm = isVmImage(image ?? "");

  return (
    <div className="flex flex-col gap-2 px-4">
      <p className="font-mono text-xs uppercase text-muted-foreground">Additional</p>
      <div className="flex flex-col gap-4">
        <d.RuntimeCard serviceIndex={serviceIndex} locked={structuralLocked} />

        <d.EnvironmentVariablesCard serviceIndex={serviceIndex} locked={manifestLocked} />

        {!isVm && <d.CommandsCard serviceIndex={serviceIndex} locked={manifestLocked} />}

        <d.ExposePortsCard serviceIndex={serviceIndex} locked={structuralLocked} />

        <d.LogsCard serviceIndex={serviceIndex} locked={structuralLocked} />
      </div>
    </div>
  );
};
