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
import { cn } from "@src/utils/styleUtils";
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
        <FormPaper className={cn({ ["border-b border-red-500"]: !!fieldState.error })}>
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
                  className="w-[100px]"
                />

                <Controller
                  control={control}
                  name={`services.${serviceIndex}.profile.ramUnit`}
                  rules={{ required: "Ram unit is required." }}
                  defaultValue=""
                  render={({ field }) => (
                    <Select value={field.value || ""} onValueChange={field.onChange}>
                      <SelectTrigger className="ml-1">
                        <SelectValue placeholder="Select unit" className="w-[75px]" />
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
              max={512}
              step={1}
              color="secondary"
              aria-label="RAM"
              onValueChange={newValue => field.onChange(newValue)}
              className="pt-2"
            />

            <FormMessage />
          </FormItem>
        </FormPaper>
      )}
    />
  );
};
