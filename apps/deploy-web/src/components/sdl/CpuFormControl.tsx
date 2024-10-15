"use client";
import { ReactNode } from "react";
import { Control } from "react-hook-form";
import { MdSpeed } from "react-icons/md";
import { CustomTooltip, FormField, FormItem, FormMessage, Input, Slider } from "@akashnetwork/ui/components";
import { InfoCircle } from "iconoir-react";

import { RentGpusFormValuesType, SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { validationConfig } from "@src/utils/akash/units";
import { cn } from "@akashnetwork/ui/utils";
import { FormPaper } from "./FormPaper";

type Props = {
  serviceIndex: number;
  children?: ReactNode;
  control: Control<SdlBuilderFormValuesType | RentGpusFormValuesType, any>;
  currentService: ServiceType;
};

export const CpuFormControl: React.FunctionComponent<Props> = ({ control, serviceIndex }) => {
  return (
    <FormField
      control={control}
      name={`services.${serviceIndex}.profile.cpu`}
      render={({ field, fieldState }) => (
        <FormPaper>
          <FormItem>
            <div className="flex items-center">
              <div className="flex items-center">
                <MdSpeed className="mr-2 text-2xl text-muted-foreground" />
                <strong className="text-sm">CPU</strong>

                <CustomTooltip
                  title={
                    <>
                      The amount of vCPU&apos;s required for this workload.
                      <br />
                      <br />
                      The maximum for a single instance is {validationConfig.maxCpuAmount} vCPU&apos;s.
                      <br />
                      <br />
                      The maximum total multiplied by the count of instances is 512 vCPU&apos;s.
                    </>
                  }
                >
                  <InfoCircle className="ml-2 text-xs text-muted-foreground" />
                </CustomTooltip>
              </div>

              <Input
                type="number"
                color="secondary"
                error={!!fieldState.error}
                value={field.value || ""}
                onChange={event => field.onChange(parseFloat(event.target.value))}
                min={0.1}
                step={0.1}
                max={validationConfig.maxCpuAmount}
                inputClassName="ml-4 w-[100px]"
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
                onValueChange={newValue => field.onChange(newValue)}
              />
            </div>

            <FormMessage className={cn({ "pt-2": !!fieldState.error })} />
          </FormItem>
        </FormPaper>
      )}
    />
  );
};
