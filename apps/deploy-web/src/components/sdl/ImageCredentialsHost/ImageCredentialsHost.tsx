"use client";
import type { Control } from "react-hook-form";
import { useWatch } from "react-hook-form";
import {
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@akashnetwork/ui/components";

import { CUSTOM_HOST_ID, type SdlBuilderFormValuesType } from "@src/types";

type Props = {
  serviceIndex: number;
  control: Control<SdlBuilderFormValuesType, any>;
};

const supportedHosts = [
  { id: "docker.io", label: "Docker Hub" },
  { id: "ghcr.io", label: "GitHub Container Registry" },
  { id: "pkg.dev", label: "Google Artifact Registry" },
  { id: "amazonaws.com", label: "AWS Elastic Container Registry" },
  { id: "azurecr.io", label: "Azure Container Registry" },
  { id: "registry.gitlab.com", label: "GitLab Container Registry" },
  { id: CUSTOM_HOST_ID, label: "Custom Registry" }
];

export const ImageCredentialsHost: React.FunctionComponent<Props> = ({ serviceIndex, control }) => {
  const selectedHost = useWatch({
    control,
    name: `services.${serviceIndex}.credentials.host`
  });
  const isCustomHost = selectedHost === CUSTOM_HOST_ID || supportedHosts.every(host => host.id !== selectedHost);

  return (
    <FormField
      control={control}
      name={`services.${serviceIndex}.credentials.host`}
      render={({ field }) => (
        <FormItem className="w-full">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="flex-1">
              <FormLabel htmlFor={`sdl-builder-service-${serviceIndex}`}>Host</FormLabel>
              <Select
                value={isCustomHost ? CUSTOM_HOST_ID : field.value}
                onValueChange={value => {
                  field.onChange(value);
                }}
              >
                <SelectTrigger id={`sdl-builder-service-${serviceIndex}`} className="mt-1">
                  <SelectValue placeholder="Select docker image registry" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {supportedHosts.map(host => (
                      <SelectItem key={host.id} value={host.id}>
                        {host.label}
                        {host.id !== CUSTOM_HOST_ID && ` - ${host.id}`}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            {isCustomHost && (
              <div className="flex-1">
                <Input
                  type="text"
                  label="Custom Registry URL"
                  placeholder="e.g., myregistry.example.com"
                  value={field.value === CUSTOM_HOST_ID ? "" : field.value || ""}
                  onChange={field.onChange}
                />
              </div>
            )}
          </div>

          <FormMessage />
        </FormItem>
      )}
    />
  );
};
