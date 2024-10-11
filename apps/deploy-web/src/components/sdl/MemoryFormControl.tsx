"use client";
import { ReactNode } from "react";
import { Control, Controller } from "react-hook-form";
import { MdMemory } from "react-icons/md";
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

import { RentGpusFormValuesType, SdlBuilderFormValuesType } from "@src/types";
import { memoryUnits } from "@src/utils/akash/units";
import { FormPaper } from "./FormPaper";

type Props = {
  serviceIndex: number;
  children?: ReactNode;
  control: Control<SdlBuilderFormValuesType | RentGpusFormValuesType, any>;
};

export const MemoryFormControl: React.FunctionComponent<Props> = ({ control, serviceIndex }) => {
  return (
    <FormField
      control={control}
      name={`services.${serviceIndex}.profile.ram`}
      render={({ field, fieldState }) => (
        <FormPaper>
          <FormItem>
            <div className="flex flex-col items-start sm:flex-row sm:items-center">
              <div className="flex items-center">
                <MdMemory className="mr-2 text-2xl text-muted-foreground" />
                <strong className="text-sm">Memory</strong>

                <CustomTooltip
                  title={
                    <>
                      The amount of memory required for this workload.
                      <br />
                      <br />
                      The maximum for a single instance is 512 Gi.
                      <br />
                      <br />
                      The maximum total multiplied by the count of instances is 1024 Gi.
                    </>
                  }
                >
                  <InfoCircle className="ml-2 text-xs text-muted-foreground" />
                </CustomTooltip>
              </div>

              <div className="mt-2 flex items-center sm:ml-4 sm:mt-0">
                <Input
                  type="number"
                  error={!!fieldState.error}
                  color="secondary"
                  value={field.value || ""}
                  onChange={event => field.onChange(parseFloat(event.target.value))}
                  min={1}
                  step={1}
                  inputClassName="w-[100px]"
                />

                <Controller
                  control={control}
                  name={`services.${serviceIndex}.profile.ramUnit`}
                  defaultValue=""
                  render={({ field }) => (
                    <Select value={field.value || ""} onValueChange={field.onChange}>
                      <SelectTrigger className="ml-1 w-[75px]">
                        <SelectValue placeholder="Select unit" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {memoryUnits.map(t => {
                            return (
                              <SelectItem key={t.id} value={t.suffix}>
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
              aria-label="RAM"
              onValueChange={newValue => field.onChange(newValue[0])}
              className="pt-2"
            />

            <FormMessage />
          </FormItem>
        </FormPaper>
      )}
    />
  );
};
