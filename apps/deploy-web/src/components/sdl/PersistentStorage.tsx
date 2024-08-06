"use client";
import { ReactNode } from "react";
import { Control, Controller } from "react-hook-form";
import { MdStorage } from "react-icons/md";
import {
  Checkbox,
  CustomTooltip,
  FormField,
  FormInput,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Label,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Slider
} from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { InfoCircle } from "iconoir-react";

import { RentGpusFormValuesType, SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { persistentStorageTypes, storageUnits } from "@src/utils/akash/units";
import { FormPaper } from "./FormPaper";

type Props = {
  currentService: ServiceType;
  serviceIndex: number;
  children?: ReactNode;
  control: Control<SdlBuilderFormValuesType | RentGpusFormValuesType, any>;
};

export const PersistentStorage: React.FunctionComponent<Props> = ({ currentService, serviceIndex, control }) => {
  return (
    <FormPaper>
      <FormField
        control={control}
        name={`services.${serviceIndex}.profile.persistentStorage`}
        render={({ field, fieldState }) => (
          <FormItem>
            <div className="flex flex-col items-start sm:flex-row sm:items-center">
              <div className="flex items-center">
                <div className="flex items-center">
                  <MdStorage className="mr-2 text-2xl text-muted-foreground" />
                  <strong className="text-sm">Persistent Storage</strong>

                  <CustomTooltip
                    title={
                      <>
                        The amount of persistent storage required for this workload.
                        <br />
                        <br />
                        This storage is mounted on a persistent volume and persistent through the lifetime of the deployment
                        <br />
                        <br />
                        <a href="https://akash.network/docs/network-features/persistent-storage/" target="_blank" rel="noopener">
                          View official documentation.
                        </a>
                      </>
                    }
                  >
                    <InfoCircle className="ml-2 text-xs text-muted-foreground" />
                  </CustomTooltip>
                </div>

                <Controller
                  control={control}
                  name={`services.${serviceIndex}.profile.hasPersistentStorage`}
                  render={({ field }) => <Checkbox checked={field.value} onCheckedChange={field.onChange} className="ml-4" />}
                />
              </div>

              {currentService.profile.hasPersistentStorage && (
                <div className="mt-2 flex items-center sm:ml-4 sm:mt-0">
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
                    name={`services.${serviceIndex}.profile.persistentStorageUnit`}
                    defaultValue=""
                    render={({ field }) => (
                      <Select value={field.value || ""} onValueChange={field.onChange}>
                        <SelectTrigger className="ml-1 w-[75px]">
                          <SelectValue placeholder="Select unit" />
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
              )}
            </div>

            {currentService.profile.hasPersistentStorage && (
              <Slider value={[field.value || 0]} min={1} max={512} step={1} onValueChange={newValue => field.onChange(newValue)} className="pt-2" />
            )}

            <FormMessage className={cn({ "pt-2": !!fieldState.error })} />
          </FormItem>
        )}
      />

      {currentService.profile.hasPersistentStorage && (
        <div>
          <div className="mt-4 flex items-start">
            <FormField
              control={control}
              name={`services.${serviceIndex}.profile.persistentStorageParam.name`}
              render={({ field }) => (
                <FormInput
                  type="text"
                  label={
                    <div className="inline-flex items-center">
                      Name
                      <CustomTooltip
                        title={
                          <>
                            The name of the persistent volume.
                            <br />
                            <br />
                            Multiple services can gain access to the same volume by name.
                          </>
                        }
                      >
                        <InfoCircle className="ml-2 text-xs text-muted-foreground" />
                      </CustomTooltip>
                    </div>
                  }
                  value={field.value}
                  onChange={event => field.onChange(event.target.value)}
                  className="flex-grow"
                />
              )}
            />
            <div className="ml-4 flex items-center">
              <Label className="whitespace-nowrap">Read only</Label>

              <Controller
                control={control}
                name={`services.${serviceIndex}.profile.persistentStorageParam.readOnly`}
                render={({ field }) => <Checkbox checked={field.value} onCheckedChange={field.onChange} className="ml-2" />}
              />
            </div>
          </div>
          <div className="mt-4 flex items-start">
            <FormField
              control={control}
              name={`services.${serviceIndex}.profile.persistentStorageParam.type`}
              render={({ field }) => (
                <FormItem className="w-full basis-[40%]">
                  <FormLabel htmlFor={`persistent-storage-type-${currentService.id}`}>Type</FormLabel>
                  <Select value={field.value || ""} onValueChange={field.onChange}>
                    <SelectTrigger id={`persistent-storage-type-${currentService.id}`}>
                      <SelectValue placeholder="Select token" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {persistentStorageTypes.map(t => {
                          return (
                            <SelectItem key={t.id} value={t.className}>
                              {t.name}
                            </SelectItem>
                          );
                        })}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name={`services.${serviceIndex}.profile.persistentStorageParam.mount`}
              render={({ field }) => (
                <FormInput
                  type="text"
                  label={
                    <div className="inline-flex items-center">
                      Mount
                      <CustomTooltip
                        title={
                          <>
                            The path to mount the persistent volume to.
                            <br />
                            <br />
                            Example: /mnt/data
                          </>
                        }
                      >
                        <InfoCircle className="ml-2 text-xs text-muted-foreground" />
                      </CustomTooltip>
                    </div>
                  }
                  placeholder="Example: /mnt/data"
                  value={field.value}
                  onChange={event => field.onChange(event.target.value)}
                  className="ml-2 w-full"
                />
              )}
            />
          </div>
        </div>
      )}
    </FormPaper>
  );
};
