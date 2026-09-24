"use client";
import type { FC } from "react";
import { useState } from "react";
import { useController, useFormContext, useWatch } from "react-hook-form";
import { Input, Tabs, TabsContent, TabsList, TabsTrigger, Textarea } from "@akashnetwork/ui/components";
import { GlobeIcon, KeyRoundIcon, TerminalIcon } from "lucide-react";

import type { ExposeType, SdlBuilderFormValuesType } from "@src/types";
import { RESERVED_ENV_KEYS as RESERVED_ENV_KEY_LIST } from "@src/types/sdlBuilder/sdlBuilder";
import { isVmImage } from "@src/utils/sdl/vmImages";
import { UpdateSectionRule } from "./UpdateSectionRule";
import { UpdateVariablesPanel } from "./UpdateVariablesPanel";

const RESERVED_ENV_KEYS = new Set<string>(RESERVED_ENV_KEY_LIST);
const PORTS_HELPER = "Protocol, routing, and adding or removing exposed ports require a new deployment.";

type NetworkingTab = "ports" | "variables" | "command";

export interface UpdateNetworkingSectionProps {
  serviceIndex: number;
  locked: boolean;
}

/** A managed VM gets no Command tab, since overriding its entrypoint would break the SSH bootstrap it was created with. */
export const UpdateNetworkingSection: FC<UpdateNetworkingSectionProps> = ({ serviceIndex, locked }) => {
  const { control } = useFormContext<SdlBuilderFormValuesType>();
  const [tab, setTab] = useState<NetworkingTab>("ports");
  const expose = useWatch({ control, name: `services.${serviceIndex}.expose` }) ?? [];
  const env = useWatch({ control, name: `services.${serviceIndex}.env` }) ?? [];
  const image = useWatch({ control, name: `services.${serviceIndex}.image` }) ?? "";
  const variableCount = env.filter(variable => !RESERVED_ENV_KEYS.has(variable.key)).length;
  const isVm = isVmImage(image);

  return (
    <div className="flex flex-col gap-3">
      <UpdateSectionRule title="Networking & runtime" />
      <Tabs value={tab} onValueChange={value => setTab(value as NetworkingTab)} className="rounded-lg border">
        <TabsList className="grid h-auto w-full auto-cols-fr grid-flow-col rounded-b-none rounded-t-lg bg-muted p-1">
          <TabsTrigger value="ports" className="gap-2">
            <GlobeIcon className="h-4 w-4" aria-hidden="true" />
            Ports <span className="text-muted-foreground">{expose.length}</span>
          </TabsTrigger>
          <TabsTrigger value="variables" className="gap-2">
            <KeyRoundIcon className="h-4 w-4" aria-hidden="true" />
            Vars & secrets <span className="text-muted-foreground">{variableCount}</span>
          </TabsTrigger>
          {!isVm && (
            <TabsTrigger value="command" className="gap-2">
              <TerminalIcon className="h-4 w-4" aria-hidden="true" />
              Command
            </TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="ports" className="m-0 p-4">
          <PortsPanel expose={expose} />
        </TabsContent>
        <TabsContent value="variables" className="m-0 p-4">
          <UpdateVariablesPanel serviceIndex={serviceIndex} locked={locked} />
        </TabsContent>
        {!isVm && (
          <TabsContent value="command" className="m-0 p-4">
            <CommandPanel serviceIndex={serviceIndex} locked={locked} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

const PortsPanel: FC<{ expose: ExposeType[] }> = ({ expose }) => (
  <div className="flex flex-col gap-3">
    {expose.length === 0 && <p className="text-sm text-muted-foreground">This service exposes no ports.</p>}
    {expose.map((entry, index) => (
      <div key={entry.id ?? index} role="group" aria-label={`Port ${entry.port}`} className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_2fr]">
        <ReadOnlyField label="Port (internal)" value={String(entry.port)} />
        <ReadOnlyField label="As (external)" value={String(entry.as)} />
        <ReadOnlyField label="Protocol" value={protocolLabelOf(entry)} />
        <ReadOnlyField label="Routing" value={routingLabelOf(entry)} />
      </div>
    ))}
    <p className="text-sm text-muted-foreground">{PORTS_HELPER}</p>
  </div>
);

const ReadOnlyField: FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex flex-col gap-1">
    <span className="text-sm">{label}</span>
    <Input aria-label={label} value={value} disabled readOnly inputClassName="h-10 border-dashed font-mono" />
  </div>
);

function protocolLabelOf(entry: ExposeType): string {
  return (entry.proto ?? "http").toUpperCase();
}

function routingLabelOf(entry: ExposeType): string {
  if (entry.ipName) return `IP ${entry.ipName}`;
  return entry.global ? "Public (any IP)" : "Internal";
}

const CommandPanel: FC<{ serviceIndex: number; locked: boolean }> = ({ serviceIndex, locked }) => {
  const { control } = useFormContext<SdlBuilderFormValuesType>();
  const command = useController({ control, name: `services.${serviceIndex}.command.command` });
  const arg = useController({ control, name: `services.${serviceIndex}.command.arg` });
  const commandId = `update-command-${serviceIndex}`;
  const argId = `update-command-arg-${serviceIndex}`;

  return (
    <fieldset disabled={locked} className="m-0 grid min-w-0 gap-3 border-0 p-0 md:grid-cols-2">
      <div className="flex flex-col gap-1">
        <Textarea
          id={commandId}
          label="Command"
          rows={3}
          spellCheck={false}
          placeholder={"One token per line, for example:\nbash\n-c"}
          value={command.field.value ?? ""}
          onChange={event => command.field.onChange(event.target.value)}
          onBlur={command.field.onBlur}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Textarea
          id={argId}
          label="Arguments"
          rows={3}
          spellCheck={false}
          placeholder={"One token per line, for example:\napt-get update"}
          value={arg.field.value ?? ""}
          onChange={event => arg.field.onChange(event.target.value)}
          onBlur={arg.field.onBlur}
        />
      </div>
    </fieldset>
  );
};
