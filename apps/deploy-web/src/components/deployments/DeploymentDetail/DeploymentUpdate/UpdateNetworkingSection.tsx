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
const PORTS_HELPER =
  "Protocol, routing, and adding or removing exposed ports require a new deployment. If you change a public port other than 80, the provider assigns it a new random public port, and the service's other random ports can change too.";
const LEASED_IP_NOTICE = "This port is reached through a leased IP, so its numbers can't change without a new deployment.";

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
        <TabsList className="grid h-auto w-full rounded-b-none rounded-t-lg bg-muted p-1 sm:auto-cols-fr sm:grid-flow-col">
          <TabsTrigger value="ports" className="justify-start gap-2 px-3 sm:justify-center sm:px-6">
            <GlobeIcon className="h-4 w-4" aria-hidden="true" />
            Ports <span className="text-muted-foreground">{expose.length}</span>
          </TabsTrigger>
          <TabsTrigger value="variables" className="justify-start gap-2 px-3 sm:justify-center sm:px-6">
            <KeyRoundIcon className="h-4 w-4" aria-hidden="true" />
            Vars & secrets <span className="text-muted-foreground">{variableCount}</span>
          </TabsTrigger>
          {!isVm && (
            <TabsTrigger value="command" className="justify-start gap-2 px-3 sm:justify-center sm:px-6">
              <TerminalIcon className="h-4 w-4" aria-hidden="true" />
              Command
            </TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="ports" className="m-0 p-4">
          <PortsPanel serviceIndex={serviceIndex} expose={expose} locked={locked} />
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

const PortsPanel: FC<{ serviceIndex: number; expose: ExposeType[]; locked: boolean }> = ({ serviceIndex, expose, locked }) => (
  <div className="flex flex-col gap-3">
    {expose.length === 0 && <p className="text-sm text-muted-foreground">This service exposes no ports.</p>}
    {expose.map((entry, exposeIndex) => (
      <PortRow key={entry.id ?? exposeIndex} serviceIndex={serviceIndex} exposeIndex={exposeIndex} entry={entry} locked={locked} />
    ))}
    <p className="text-sm text-muted-foreground">{PORTS_HELPER}</p>
  </div>
);

interface PortRowProps {
  serviceIndex: number;
  exposeIndex: number;
  entry: ExposeType;
  locked: boolean;
}

/** A provider keeps a leased IP on the ports it was declared with, so those numbers stay read-only here. */
const PortRow: FC<PortRowProps> = ({ serviceIndex, exposeIndex, entry, locked }) => {
  const isLeasedIp = !!entry.ipName;

  return (
    <div role="group" aria-label={`Port ${exposeIndex + 1}`} className="flex flex-col gap-2">
      <fieldset disabled={locked || isLeasedIp} className="m-0 grid min-w-0 gap-3 border-0 p-0 md:grid-cols-[1fr_1fr_1fr_2fr]">
        <PortNumberField label="Port (internal)" name={`services.${serviceIndex}.expose.${exposeIndex}.port`} />
        <PortNumberField label="As (external)" name={`services.${serviceIndex}.expose.${exposeIndex}.as`} />
        <ReadOnlyField label="Protocol" value={protocolLabelOf(entry)} />
        <ReadOnlyField label="Routing" value={routingLabelOf(entry)} />
      </fieldset>
      {isLeasedIp && <p className="text-sm text-muted-foreground">{LEASED_IP_NOTICE}</p>}
    </div>
  );
};

const PortNumberField: FC<{ label: string; name: `services.${number}.expose.${number}.${"port" | "as"}` }> = ({ label, name }) => {
  const { control } = useFormContext<SdlBuilderFormValuesType>();
  const { field, fieldState } = useController({ control, name });

  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm">{label}</span>
      <Input
        aria-label={label}
        type="number"
        min={1}
        max={65535}
        value={field.value ?? ""}
        onChange={event => field.onChange(portNumberOf(event.target.value))}
        onBlur={field.onBlur}
        error={!!fieldState.error}
        inputClassName="h-10 font-mono"
      />
      {fieldState.error && <p className="text-xs text-destructive">{fieldState.error.message}</p>}
    </div>
  );
};

/** An emptied box holds null, because the form reads an undefined field as unset and puts the loaded port back. */
function portNumberOf(value: string): number | null {
  return value === "" ? null : Number(value);
}

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
