"use client";
import type { Control, UseFormSetValue } from "react-hook-form";
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

import type { SdlBuilderFormValuesType } from "@src/types";

type Props = {
  serviceIndex: number;
  control: Control<SdlBuilderFormValuesType, any>;
  setValue: UseFormSetValue<SdlBuilderFormValuesType>;
};

const supportedHosts = [
  { id: "docker.io", label: "Docker Hub" },
  { id: "ghcr.io", label: "GitHub Container Registry" },
  { id: "gcr.io", label: "Google Container Registry" },
  { id: "ecr", label: "AWS Elastic Container Registry" },
  { id: "azurecr.io", label: "Azure Container Registry" },
  { id: "registry.gitlab.com", label: "GitLab Container Registry" },
  { id: "custom", label: "Custom Registry" }
];

export const ImageCredentialsHost: React.FunctionComponent<Props> = ({ serviceIndex, control, setValue }) => {
  const selectedHost = useWatch({
    control,
    name: `services.${serviceIndex}.credentials.host`
  });

  return (
    <>
      <FormField
        control={control}
        name={`services.${serviceIndex}.credentials.host`}
        render={({ field }) => (
          <FormItem className="w-full">
            <FormLabel>Host</FormLabel>
            <Select
              value={field.value}
              onValueChange={value => {
                field.onChange(value);
                if (value !== "custom") {
                  setValue(`services.${serviceIndex}.credentials.customRegistryUrl`, undefined);
                }
              }}
            >
              <SelectTrigger id="credentials-host">
                <SelectValue placeholder="Select docker image registry" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {supportedHosts.map(host => (
                    <SelectItem key={host.id} value={host.id}>
                      {host.label}
                      {host.id !== "custom" && ` - ${host.id}`}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            <FormMessage />
          </FormItem>
        )}
      />

      {selectedHost === "custom" && (
        <FormField
          control={control}
          name={`services.${serviceIndex}.credentials.customRegistryUrl`}
          render={({ field }) => (
            <FormItem className="mt-2 w-full">
              <FormLabel>Custom Registry URL</FormLabel>
              <Input type="text" placeholder="e.g., myregistry.example.com" value={field.value || ""} onChange={field.onChange} />
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </>
  );
};
