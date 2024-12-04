"use client";
import { Control } from "react-hook-form";
import {
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@akashnetwork/ui/components";

import { SdlBuilderFormValuesType } from "@src/types";

type Props = {
  serviceIndex: number;
  control: Control<SdlBuilderFormValuesType, any>;
};

const supportedHosts = [
  { id: 'docker.io', label: 'Docker Hub' },
  { id: 'ghcr.io', label: 'GitHub Container Registry' }
];

export const ImageCredentialsHost: React.FunctionComponent<Props> = ({
  serviceIndex,
  control,
}) => {
  return (
    <FormField
      control={control}
      name={`services.${serviceIndex}.credentials.host`}
      render={({ field }) => (
        <FormItem className="w-full">
          <FormLabel>Host</FormLabel>
          <Select value={field.value} onValueChange={field.onChange}>
            <SelectTrigger id="credentials-host">
              <SelectValue placeholder="Select docker image registry" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {supportedHosts.map(host => (
                  <SelectItem key={host.id} value={host.id}>
                    {host.label} - {host.id}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <FormMessage />
        </FormItem>
      )}
    />
  );
};
