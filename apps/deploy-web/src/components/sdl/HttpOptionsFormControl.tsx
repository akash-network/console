"use client";
import { ReactNode } from "react";
import { Control, Controller } from "react-hook-form";
import { Checkbox, CustomTooltip, FormField, FormInput, FormItem, Label, MultipleSelector } from "@akashnetwork/ui/components";
import { InfoCircle } from "iconoir-react";

import { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { nextCases } from "@src/utils/sdl/data";
import { cn } from "@src/utils/styleUtils";
import { FormPaper } from "./FormPaper";

type Props = {
  serviceIndex: number;
  exposeIndex: number;
  services: ServiceType[];
  control: Control<SdlBuilderFormValuesType, any>;
  children?: ReactNode;
};

export const HttpOptionsFormControl: React.FunctionComponent<Props> = ({ control, serviceIndex, exposeIndex, services }) => {
  const currentService = services[serviceIndex];

  return (
    <FormPaper className="h-full" contentClassName="h-full flex items-start flex-col justify-between">
      <div className={cn("flex items-center", { ["mb-8"]: !!currentService.expose[exposeIndex]?.hasCustomHttpOptions })}>
        <div className="flex items-center">
          <strong className="text-sm">HTTP Options</strong>

          <CustomTooltip
            title={
              <>
                Akash deployment SDL services stanza definitions have been augmented to include “http_options” allowing granular specification of HTTP endpoint
                parameters. Inclusion of the parameters in this section are optional but will afford detailed definitions of attributes such as body/payload max
                size where necessary.
                <br />
                <br />
                <a href="https://akash.network/docs/network-features/deployment-http-options/" target="_blank" rel="noopener">
                  View official documentation.
                </a>
              </>
            }
          >
            <InfoCircle className="ml-2 text-xs text-muted-foreground" />
          </CustomTooltip>
        </div>

        <div className="ml-8 flex items-center">
          <Controller
            control={control}
            name={`services.${serviceIndex}.expose.${exposeIndex}.hasCustomHttpOptions`}
            render={({ field }) => (
              <div className="flex items-center space-x-2">
                <Checkbox id={`custom-options-${serviceIndex}-${exposeIndex}`} checked={field.value} onCheckedChange={field.onChange} />
                <label
                  htmlFor={`custom-options-${serviceIndex}-${exposeIndex}`}
                  className="cursor-pointer text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Custom Options
                </label>
              </div>
            )}
          />
        </div>
      </div>

      {currentService.expose[exposeIndex]?.hasCustomHttpOptions && (
        <>
          <FormField
            control={control}
            name={`services.${serviceIndex}.expose.${exposeIndex}.httpOptions.maxBodySize`}
            render={({ field, fieldState }) => (
              <FormInput
                type="number"
                label={
                  <div className="inline-flex items-center">
                    Max Body Size
                    <CustomTooltip title="Sets the maximum size of an individual HTTP request body.">
                      <InfoCircle className="ml-2 text-xs text-muted-foreground" />
                    </CustomTooltip>
                  </div>
                }
                className="mb-2 w-full"
                value={field.value}
                error={!!fieldState.error}
                onChange={event => field.onChange(parseInt(event.target.value))}
                min={0}
              />
            )}
          />

          <FormField
            control={control}
            name={`services.${serviceIndex}.expose.${exposeIndex}.httpOptions.readTimeout`}
            render={({ field, fieldState }) => (
              <FormInput
                type="number"
                label={
                  <div className="inline-flex items-center">
                    Read Timeout
                    <CustomTooltip title="Duration the proxy will wait for a response from the service.">
                      <InfoCircle className="ml-2 text-xs text-muted-foreground" />
                    </CustomTooltip>
                  </div>
                }
                className="mb-2 w-full"
                value={field.value}
                error={!!fieldState.error}
                onChange={event => field.onChange(parseInt(event.target.value))}
                min={0}
              />
            )}
          />

          <FormField
            control={control}
            name={`services.${serviceIndex}.expose.${exposeIndex}.httpOptions.sendTimeout`}
            render={({ field, fieldState }) => (
              <FormInput
                type="number"
                label={
                  <div className="inline-flex items-center">
                    Send Timeout
                    <CustomTooltip title="Duration the proxy will wait for the service to accept a request.">
                      <InfoCircle className="ml-2 text-xs text-muted-foreground" />
                    </CustomTooltip>
                  </div>
                }
                className="mb-2 w-full"
                value={field.value}
                error={!!fieldState.error}
                onChange={event => field.onChange(parseInt(event.target.value))}
                min={0}
              />
            )}
          />

          <FormField
            control={control}
            name={`services.${serviceIndex}.expose.${exposeIndex}.httpOptions.nextTries`}
            render={({ field, fieldState }) => (
              <FormInput
                type="number"
                label={
                  <div className="inline-flex items-center">
                    Next Tries
                    <CustomTooltip title="Number of attempts the proxy will attempt another replica.">
                      <InfoCircle className="ml-2 text-xs text-muted-foreground" />
                    </CustomTooltip>
                  </div>
                }
                className="mb-2 w-full"
                value={field.value}
                error={!!fieldState.error}
                onChange={event => field.onChange(parseInt(event.target.value))}
                min={0}
              />
            )}
          />

          <FormField
            control={control}
            name={`services.${serviceIndex}.expose.${exposeIndex}.httpOptions.nextTimeout`}
            render={({ field, fieldState }) => (
              <FormInput
                type="number"
                label={
                  <div className="inline-flex items-center">
                    Next Timeout
                    <CustomTooltip title="Duration the proxy will wait for the service to connect to another replica.">
                      <InfoCircle className="ml-2 text-xs text-muted-foreground" />
                    </CustomTooltip>
                  </div>
                }
                className="mb-2 w-full"
                value={field.value}
                error={!!fieldState.error}
                onChange={event => field.onChange(parseInt(event.target.value))}
                min={0}
              />
            )}
          />

          <FormField
            control={control}
            name={`services.${serviceIndex}.expose.${exposeIndex}.httpOptions.nextCases`}
            defaultValue={[]}
            render={({ field }) => (
              <FormItem className="w-full">
                <Label className="inline-flex items-center">
                  Next Cases
                  <CustomTooltip title="Defines the cases where the proxy will try another replica in the service.  Reference the upcoming “Next Cases Attribute Usage” section for details pertaining to allowed values.">
                    <InfoCircle className="ml-2 text-xs text-muted-foreground" />
                  </CustomTooltip>
                </Label>
                <MultipleSelector
                  value={field.value.map(v => ({ value: v, label: v })) || []}
                  options={nextCases}
                  hidePlaceholderWhenSelected
                  placeholder="Select Next Cases"
                  emptyIndicator={<p className="text-md text-center leading-10 text-gray-600 dark:text-gray-400">no results found.</p>}
                />
              </FormItem>
            )}
          />
        </>
      )}
    </FormPaper>
  );
};
