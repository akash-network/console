"use client";
import type { Control } from "react-hook-form";
import { FormField, FormItem, FormMessage, Input } from "@akashnetwork/ui/components";

import type { SdlBuilderFormValuesType } from "@src/types";

type Props = {
  serviceIndex: number;
  control: Control<SdlBuilderFormValuesType, any>;
};

export const ImageCredentialsUsername: React.FunctionComponent<Props> = ({ serviceIndex, control }) => {
  return (
    <FormField
      control={control}
      name={`services.${serviceIndex}.credentials.username`}
      render={({ field, fieldState }) => (
        <FormItem className="w-full">
          <Input
            type="text"
            label={<div className="inline-flex items-center">Username</div>}
            value={field.value}
            error={!!fieldState.error}
            onChange={event => field.onChange(event.target.value || "")}
            data-testid="credentials-username-input"
          />

          <FormMessage />
        </FormItem>
      )}
    />
  );
};
