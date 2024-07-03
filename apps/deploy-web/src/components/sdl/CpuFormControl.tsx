"use client";
import { ReactNode } from "react";
import { Control, Controller } from "react-hook-form";
import { MdSpeed } from "react-icons/md";
import { CustomTooltip, FormDescription, FormItem, Input, Slider } from "@akashnetwork/ui/components";
import { InfoCircle } from "iconoir-react";

import { RentGpusFormValues, SdlBuilderFormValues, Service } from "@src/types";
import { validationConfig } from "@src/utils/akash/units";
import { cn } from "@src/utils/styleUtils";
import { FormPaper } from "./FormPaper";

type Props = {
  serviceIndex: number;
  children?: ReactNode;
  control: Control<SdlBuilderFormValues | RentGpusFormValues, any>;
  currentService: Service;
};

export const CpuFormControl: React.FunctionComponent<Props> = ({ control, serviceIndex, currentService }) => {
  return (
    <Controller
      control={control}
      name={`services.${serviceIndex}.profile.cpu`}
      rules={{
        validate: v => {
          if (!v) return "CPU amount is required.";

          const _value = v || 0;

          if (currentService.count === 1 && _value < 0.1) {
            return "Minimum amount of CPU for a single service instance is 0.1.";
          } else if (currentService.count === 1 && _value > validationConfig.maxCpuAmount) {
            return `Maximum amount of CPU for a single service instance is ${validationConfig.maxCpuAmount}.`;
          } else if (currentService.count > 1 && currentService.count * _value > validationConfig.maxGroupCpuCount) {
            return `Maximum total amount of CPU for a single service instance group is ${validationConfig.maxGroupCpuCount}.`;
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
            <div className="flex items-center">
              <div className="flex items-center">
                <MdSpeed className="mr-2 text-2xl text-muted-foreground" />
                <strong className="text-sm">CPU</strong>

                <CustomTooltip
                  title={
                    <>
                      The amount of vCPU's required for this workload.
                      <br />
                      <br />
                      The maximum for a single instance is {validationConfig.maxCpuAmount} vCPU's.
                      <br />
                      <br />
                      The maximum total multiplied by the count of instances is 512 vCPU's.
                    </>
                  }
                >
                  <InfoCircle className="ml-2 text-xs text-muted-foreground" />
                </CustomTooltip>
              </div>

              <Input
                type="number"
                color="secondary"
                // error={!!fieldState.error}
                value={field.value || ""}
                onChange={event => field.onChange(parseFloat(event.target.value))}
                min={0.1}
                step={0.1}
                max={validationConfig.maxCpuAmount}
                className="ml-4 w-[100px]"
              />
            </div>

            <div className="pt-2">
              <Slider
                value={[field.value || 0]}
                min={0.1}
                max={validationConfig.maxCpuAmount}
                step={1}
                color="secondary"
                aria-label="CPU"
                // valueLabelDisplay="auto"
                onValueChange={newValue => field.onChange(newValue)}
              />
            </div>

            {!!fieldState.error && <FormDescription>{fieldState.error.message}</FormDescription>}
          </FormItem>
        </FormPaper>
      )}
    />
  );
};
