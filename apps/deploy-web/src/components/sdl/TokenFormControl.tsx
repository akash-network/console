"use client";
import type { ReactElement } from "react";
import type { Control, FieldPathValue, FieldValues, Path } from "react-hook-form";
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
  SelectValue
} from "@akashnetwork/ui/components";

import { useSdlDenoms } from "@src/hooks/useDenom";
import type { ServiceType } from "@src/types";

interface ServicesFieldValues extends FieldValues {
  services: ServiceType[];
}

interface Props<TFieldValues extends ServicesFieldValues, TName extends Path<TFieldValues> = Path<TFieldValues>> {
  name: TName;
  defaultValue?: FieldPathValue<TFieldValues, TName>;
  control: Control<TFieldValues>;
}

export const TokenFormControl = <F extends ServicesFieldValues>({ control, name, defaultValue }: Props<F>): ReactElement<Props<F>> => {
  const supportedSdlDenoms = useSdlDenoms();

  return (
    <FormField
      control={control}
      name={name}
      defaultValue={defaultValue}
      render={({ field }) => {
        return (
          <FormItem>
            <FormLabel>Token</FormLabel>
            <Select value={field.value || ""} onValueChange={field.onChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select token" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {supportedSdlDenoms.map(t => {
                    return (
                      <SelectItem key={t.id} value={t.value}>
                        {t.tokenLabel}
                      </SelectItem>
                    );
                  })}
                </SelectGroup>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
};
