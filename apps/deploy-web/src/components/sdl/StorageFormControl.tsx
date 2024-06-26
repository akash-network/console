"use client";
import { ReactNode } from "react";
import { Control, Controller } from "react-hook-form";
import { MdStorage } from "react-icons/md";
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
import { FormPaper } from "./FormPaper";
import { storageUnits, validationConfig } from "@src/utils/akash/units";

type Props = {
  serviceIndex: number;
  children?: ReactNode;
  control: Control<SdlBuilderFormValues | RentGpusFormValues, any>;
  currentService: Service;
};

export const StorageFormControl: React.FunctionComponent<Props> = ({ control, serviceIndex, currentService }) => {
  return (
    <Controller
      control={control}
      rules={{
        validate: v => {
          if (!v) return "Storage amount is required.";

          const currentUnit = storageUnits.find(u => currentService.profile.storageUnit === u.suffix);
          const _value = (v || 0) * (currentUnit?.value || 0);

          if (currentService.count * _value < validationConfig.minStorage) {
            return "Minimum amount of storage for a single service instance is 5 Mi.";
          } else if (currentService.count * _value > validationConfig.maxStorage) {
            return "Maximum amount of storage for a single service instance is 32 Ti.";
          }

          return true;
        }
      }}
      name={`services.${serviceIndex}.profile.storage`}
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

              <div className="mt-2 flex items-center sm:ml-4 sm:mt-0">
                <Input
                  type="number"
                  color="secondary"
                  value={field.value || ""}
                  // error={!!fieldState.error}
                  onChange={event => field.onChange(parseFloat(event.target.value))}
                  min={1}
                  step={1}
                  className="w-[100px]"
                />

                <Controller
                  control={control}
                  name={`services.${serviceIndex}.profile.storageUnit`}
                  rules={{ required: "Storage unit is required." }}
                  defaultValue=""
                  render={({ field }) => (
                    <Select value={field.value || ""} onValueChange={field.onChange}>
                      <SelectTrigger className="ml-1">
                        <SelectValue placeholder="Select unit" className="w-[75px]" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {storageUnits.map(t => {
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
              aria-label="Storage"
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
