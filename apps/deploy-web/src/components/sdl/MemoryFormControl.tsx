"use client";
import { ReactNode } from "react";
import { Control, Controller } from "react-hook-form";
import { MdMemory } from "react-icons/md";
import {
  CustomTooltip,
  FormDescription,
  FormItem,
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

import { RentGpusFormValues, SdlBuilderFormValues, Service } from "@src/types";
import { cn } from "@src/utils/styleUtils";
import { memoryUnits, validationConfig } from "../shared/akash/units";
import { FormPaper } from "./FormPaper";

type Props = {
  serviceIndex: number;
  children?: ReactNode;
  control: Control<SdlBuilderFormValues | RentGpusFormValues, any>;
  currentService: Service;
};

export const MemoryFormControl: React.FunctionComponent<Props> = ({ control, serviceIndex, currentService }) => {
  return (
    <Controller
      control={control}
      name={`services.${serviceIndex}.profile.ram`}
      rules={{
        validate: v => {
          if (!v) return "Memory amount is required.";

          const currentUnit = memoryUnits.find(u => currentService.profile.ramUnit === u.suffix);
          const _value = (v || 0) * (currentUnit?.value || 0);

          if (currentService.count === 1 && _value < validationConfig.minMemory) {
            return "Minimum amount of memory for a single service instance is 1 Mi.";
          } else if (currentService.count === 1 && currentService.count * _value > validationConfig.maxMemory) {
            return "Maximum amount of memory for a single service instance is 512 Gi.";
          } else if (currentService.count > 1 && currentService.count * _value > validationConfig.maxGroupMemory) {
            return "Maximum total amount of memory for a single service instance group is 1024 Gi.";
          }

          return true;
        }
      }}
      render={({ field, fieldState }) => (
        <FormPaper className={cn({ ["border-b border-red-500"]: !!fieldState.error })}>
          <FormItem
          // className={cx(classes.formControl, classes.textField)}
          // variant="standard"
          // sx={{ marginBottom: "0 !important" }}
          // error={!!fieldState.error}
          >
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
                  // error={!!fieldState.error}
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
              // valueLabelDisplay="auto"
              onValueChange={newValue => field.onChange(newValue)}
              className="pt-2"
            />

            {!!fieldState.error && <FormDescription>{fieldState.error.message}</FormDescription>}
          </FormItem>
        </FormPaper>
      )}
    />
  );
};
