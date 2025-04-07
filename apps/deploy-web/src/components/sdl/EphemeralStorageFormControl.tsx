"use client";
import type { ReactNode } from "react";
import type { Control, UseFieldArrayAppend } from "react-hook-form";
import { Controller } from "react-hook-form";
import { MdStorage } from "react-icons/md";
import {
  CustomTooltip,
  FormField,
  FormItem,
  FormMessage,
  Input,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Slider
} from "@akashnetwork/ui/components";
import { InfoCircle } from "iconoir-react";

import type { RentGpusFormValuesType, SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { storageUnits } from "@src/utils/akash/units";
import { AddStorageButton } from "./AddStorageButton";
import { FormPaper } from "./FormPaper";

type Props = {
  services: ServiceType[];
  serviceIndex: number;
  children?: ReactNode;
  control: Control<SdlBuilderFormValuesType | RentGpusFormValuesType, any>;
  appendStorage: UseFieldArrayAppend<SdlBuilderFormValuesType | RentGpusFormValuesType, `services.${number}.profile.storage`>;
};

export const EphemeralStorageFormControl: React.FunctionComponent<Props> = ({ control, services, serviceIndex, appendStorage }) => {
  return (
    <FormField
      control={control}
      name={`services.${serviceIndex}.profile.storage.0.size`}
      render={({ field, fieldState }) => (
        <FormPaper>
          <FormItem>
            <div className="flex flex-col items-start lg:flex-row lg:items-center">
              <div className="flex items-center">
                <MdStorage className="mr-2 text-2xl text-muted-foreground" />
                <strong className="text-sm">Ephemeral Storage</strong>

                <CustomTooltip
                  title={
                    <>
                      The amount of ephemeral disk storage required for this workload.
                      <br />
                      <br />
                      This disk storage is ephemeral, meaning it will be wiped out on every deployment update or provider reboot.
                      <br />
                      <br />
                      The maximum for a single instance is 32 Ti.
                      <br />
                      <br />
                      The maximum total multiplied by the count of instances is also 32 Ti.
                    </>
                  }
                >
                  <InfoCircle className="ml-2 text-xs text-muted-foreground" />
                </CustomTooltip>
              </div>

              <div className="mt-2 flex items-center lg:ml-4 lg:mt-0">
                <Input
                  type="number"
                  color="secondary"
                  value={field.value || ""}
                  error={!!fieldState.error}
                  onChange={event => field.onChange(parseFloat(event.target.value))}
                  min={1}
                  step={1}
                  inputClassName="w-[100px]"
                />

                <Controller
                  control={control}
                  name={`services.${serviceIndex}.profile.storage.0.unit`}
                  defaultValue=""
                  render={({ field }) => (
                    <Select value={field.value?.toLowerCase() || ""} onValueChange={field.onChange}>
                      <SelectTrigger className="ml-1 w-[75px]">
                        <SelectValue placeholder="Select unit" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {storageUnits.map(t => {
                            return (
                              <SelectItem key={t.id} value={t.suffix.toLowerCase()}>
                                {t.suffix}
                              </SelectItem>
                            );
                          })}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <Slider
              value={[field.value || 0]}
              min={1}
              max={5120}
              step={1}
              color="secondary"
              aria-label="Storage"
              onValueChange={newValue => field.onChange(newValue[0])}
              className="pt-2"
            />

            <FormMessage />
          </FormItem>
          <AddStorageButton services={services} serviceIndex={serviceIndex} control={control} storageIndex={0} appendStorage={appendStorage} />
        </FormPaper>
      )}
    />
  );
};
