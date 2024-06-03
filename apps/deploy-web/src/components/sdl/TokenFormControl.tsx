"use client";
import { ReactElement } from "react";
import { Control, Controller, FieldPathValue, FieldValues, Path } from "react-hook-form";
import { makeStyles } from "tss-react/mui";

import { useSdlDenoms } from "@src/hooks/useDenom";
import { Service } from "@src/types";
import { FormItem } from "../ui/form";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

interface ServicesFieldValues extends FieldValues {
  services: Service[];
}

interface Props<TFieldValues extends ServicesFieldValues, TName extends Path<TFieldValues> = Path<TFieldValues>> {
  name: TName;
  defaultValue?: FieldPathValue<TFieldValues, TName>;
  control: Control<TFieldValues>;
}

export const TokenFormControl = <F extends ServicesFieldValues>({ control, name, defaultValue }: Props<F>): ReactElement<Props<F>> => {
  const supportedSdlDenoms = useSdlDenoms();

  return (
    <Controller
      control={control}
      name={name}
      defaultValue={defaultValue}
      rules={{
        required: true
      }}
      render={({ fieldState, field }) => {
        return (
          <FormItem
          // TODO
          // error={!!fieldState.error}
          >
            <Label>Token</Label>
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
          </FormItem>
        );
      }}
    />
  );
};
