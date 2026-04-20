"use client";
import type { FC } from "react";
import { useState } from "react";
import type { Control, UseFormSetValue } from "react-hook-form";
import { Controller } from "react-hook-form";
import { MdLayers } from "react-icons/md";
import { buttonVariants, Checkbox, FormField, FormItem, FormMessage, Input } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { OpenInWindow } from "iconoir-react";
import Link from "next/link";

import { CommandFormModal } from "@src/components/sdl/CommandFormModal";
import { EnvFormModal } from "@src/components/sdl/EnvFormModal/EnvFormModal";
import { ExposeFormModal } from "@src/components/sdl/ExposeFormModal";
import { ImageCredentialsHost } from "@src/components/sdl/ImageCredentialsHost/ImageCredentialsHost";
import { ImageCredentialsPassword } from "@src/components/sdl/ImageCredentialsPassword";
import { ImageCredentialsUsername } from "@src/components/sdl/ImageCredentialsUsername";
import { ImageRegistryLogo } from "@src/components/sdl/ImageRegistryLogo/ImageRegistryLogo";
import type { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { CollapsibleCard } from "./CollapsibleCard";

const defaultCredentials: NonNullable<ServiceType["credentials"]> = {
  host: "docker.io",
  username: "",
  password: ""
};

type Props = {
  control: Control<SdlBuilderFormValuesType>;
  currentService: ServiceType;
  services: ServiceType[];
  serviceIndex: number;
  setValue: UseFormSetValue<SdlBuilderFormValuesType>;
};

export const ImageRuntimeCard: FC<Props> = ({ control, currentService, services, serviceIndex, setValue }) => {
  const [isEditingEnv, setIsEditingEnv] = useState(false);
  const [isEditingCommands, setIsEditingCommands] = useState(false);
  const [isEditingExpose, setIsEditingExpose] = useState(false);

  const credentials = currentService.credentials;
  const isGhcr = credentials?.host === "ghcr.io";

  const envCount = currentService.env?.length || 0;
  const envSummary = envCount > 0 ? `${envCount} var${envCount > 1 ? "s" : ""}` : "None";
  const hasCommands = (currentService.command?.command?.length || 0) > 0;
  const commandSummary = hasCommands ? "Set" : "None";
  const exposeCount = currentService.expose?.length || 0;
  const exposeSummary = exposeCount > 0 ? `${exposeCount} port${exposeCount > 1 ? "s" : ""}` : "None";

  const imageSummary = currentService.image ? currentService.image.split("/").pop() || currentService.image : "Not set";

  return (
    <>
      {isEditingEnv && <EnvFormModal control={control} onClose={() => setIsEditingEnv(false)} serviceIndex={serviceIndex} envs={currentService.env || []} />}
      {isEditingCommands && <CommandFormModal control={control} onClose={() => setIsEditingCommands(false)} serviceIndex={serviceIndex} />}
      {isEditingExpose && (
        <ExposeFormModal
          control={control}
          onClose={() => setIsEditingExpose(false)}
          serviceIndex={serviceIndex}
          expose={currentService.expose}
          services={services}
        />
      )}

      <CollapsibleCard icon={<MdLayers className="h-3.5 w-3.5" />} title="Image & Runtime" summary={imageSummary} defaultExpanded>
        <div className="space-y-4">
          <div className="space-y-3">
            <FormField
              control={control}
              name={`services.${serviceIndex}.image`}
              render={({ field, fieldState }) => (
                <FormItem className="w-full">
                  <Input
                    type="text"
                    placeholder="Example: mydockerimage:1.01"
                    value={field.value}
                    error={!!fieldState.error}
                    onChange={event => field.onChange((event.target.value || "").toLowerCase())}
                    startIconClassName="pl-2"
                    startIcon={<ImageRegistryLogo host={credentials?.host} />}
                    endIcon={
                      <Link
                        href={`https://hub.docker.com/search?q=${field.value.split(":")[0]}&type=image`}
                        className={cn(buttonVariants({ variant: "text", size: "icon" }), "text-muted-foreground")}
                        target="_blank"
                      >
                        <OpenInWindow />
                      </Link>
                    }
                    data-testid="image-name-input"
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <Controller
              control={control}
              name={`services.${serviceIndex}.hasCredentials`}
              render={({ field }) => (
                <div className="flex items-center">
                  <Checkbox
                    id={`hasCredentials-${serviceIndex}`}
                    checked={field.value}
                    onCheckedChange={checked => {
                      field.onChange(checked);
                      setValue(`services.${serviceIndex}.credentials`, checked ? defaultCredentials : undefined);
                    }}
                  />
                  <label htmlFor={`hasCredentials-${serviceIndex}`} className="ml-2 cursor-pointer text-xs text-muted-foreground">
                    Private registry
                  </label>
                </div>
              )}
            />
            {currentService.hasCredentials && (
              <>
                <ImageCredentialsHost control={control} serviceIndex={serviceIndex} />
                <div className="grid grid-cols-2 gap-2">
                  <ImageCredentialsUsername control={control} serviceIndex={serviceIndex} />
                  <ImageCredentialsPassword control={control} serviceIndex={serviceIndex} label={isGhcr ? "Personal Access Token" : "Password"} />
                </div>
              </>
            )}
          </div>

          <div className="space-y-1.5 pt-1">
            <RuntimeRow label="Environment" summary={envSummary} onEdit={() => setIsEditingEnv(true)} />
            <RuntimeRow label="Commands" summary={commandSummary} onEdit={() => setIsEditingCommands(true)} />
            <RuntimeRow label="Expose ports" summary={exposeSummary} onEdit={() => setIsEditingExpose(true)} />
          </div>
        </div>
      </CollapsibleCard>
    </>
  );
};

const RuntimeRow: FC<{ label: string; summary: string; onEdit: () => void }> = ({ label, summary, onEdit }) => (
  <div className="flex items-center justify-between">
    <span className="text-xs font-medium text-foreground">{label}</span>
    <div className="flex items-center gap-3">
      <span className="font-mono text-[11px] text-muted-foreground">{summary}</span>
      <button type="button" onClick={onEdit} className="text-xs font-medium text-primary hover:underline">
        Edit
      </button>
    </div>
  </div>
);
