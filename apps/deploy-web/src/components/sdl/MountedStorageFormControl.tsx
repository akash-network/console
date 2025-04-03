"use client";
import type { ReactNode } from "react";
import { useMemo } from "react";
import type { Control, UseFieldArrayAppend, UseFieldArrayRemove, UseFormSetValue } from "react-hook-form";
import { Controller } from "react-hook-form";
import { MdStorage } from "react-icons/md";
import {
  Button,
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
import { Bin, InfoCircle } from "iconoir-react";

import type { RentGpusFormValuesType, SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { ephemeralStorageTypes, persistentStorageTypes, storageUnits } from "@src/utils/akash/units";
import { AddStorageButton } from "./AddStorageButton";
import { FormPaper } from "./FormPaper";

type Props = {
  services: ServiceType[];
  currentService: ServiceType;
  serviceIndex: number;
  children?: ReactNode;
  control: Control<SdlBuilderFormValuesType | RentGpusFormValuesType, any>;
  storageIndex: number;
  setValue: UseFormSetValue<SdlBuilderFormValuesType>;
  appendStorage: UseFieldArrayAppend<SdlBuilderFormValuesType, `services.${number}.profile.storage`>;
  removeStorage: UseFieldArrayRemove;
};

export const MountedStorageFormControl: React.FunctionComponent<Props> = ({
  services,
  currentService,
  serviceIndex,
  control,
  storageIndex,
  appendStorage,
  removeStorage
}) => {
  const isRam = useMemo(() => {
    return currentService.profile.storage[storageIndex].type === "ram";
  }, [currentService.profile.storage, storageIndex]);

  return (
    <FormPaper>
      <FormField
        control={control}
        name={`services.${serviceIndex}.profile.storage.${storageIndex}.size`}
        render={({ field, fieldState }) => (
          <FormItem>
            <div className="flex flex-col items-start lg:flex-row lg:items-center">
              <div className="flex items-center">
                <div className="flex items-center">
                  <MdStorage className="mr-2 text-2xl text-muted-foreground" />
                  <strong className="text-sm">{isRam ? "RAM Storage" : "Persistent Storage"}</strong>

                  {!isRam && (
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
                  )}
                </div>
              </div>

              <div className="mt-2 flex flex-grow items-center lg:ml-4 lg:mt-0">
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
                  name={`services.${serviceIndex}.profile.storage.${storageIndex}.unit`}
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

                <div className="flex-grow"></div>

                <Button onClick={() => removeStorage(storageIndex)} size="icon" type="button" variant="ghost">
                  <Bin />
                </Button>
              </div>
            </div>

            <Slider value={[field.value || 0]} min={1} max={5120} step={1} onValueChange={newValue => field.onChange(newValue[0])} className="pt-2" />

            <FormMessage className={cn({ "pt-2": !!fieldState.error })} />
          </FormItem>
        )}
      />

      <div>
        <div className="mt-4 flex items-start">
          <FormField
            control={control}
            name={`services.${serviceIndex}.profile.storage.${storageIndex}.name`}
            render={({ field }) => (
              <FormInput
                type="text"
                label={
                  <div className="mb-[6px] flex justify-between">
                    <div className="inline-flex items-center">
                      Name
                      <CustomTooltip
                        title={
                          <>
                            The name of the volume.
                            <br />
                            <br />
                            Multiple services can gain access to the same volume by name.
                          </>
                        }
                      >
                        <InfoCircle className="ml-2 text-xs text-muted-foreground" />
                      </CustomTooltip>
                    </div>
                    <div className="inline-flex items-center">
                      {!isRam && (
                        <Controller
                          control={control}
                          name={`services.${serviceIndex}.profile.storage.${storageIndex}.isReadOnly`}
                          render={({ field }) => (
                            <>
                              <Checkbox
                                id={`isReadonly-${serviceIndex}-${storageIndex}`}
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                className="ml-2"
                              />
                              <Label htmlFor={`isReadonly-${serviceIndex}-${storageIndex}`} className="ml-2 whitespace-nowrap">
                                Read only
                              </Label>
                            </>
                          )}
                        />
                      )}
                    </div>
                  </div>
                }
                value={field.value}
                onChange={event => field.onChange(event.target.value)}
                className="flex-grow"
              />
            )}
          />
        </div>
        <div className="mt-4 flex items-start">
          <FormField
            control={control}
            name={`services.${serviceIndex}.profile.storage.${storageIndex}.type`}
            render={({ field }) => (
              <FormItem className="w-full basis-[40%]">
                <FormLabel htmlFor={`persistent-storage-type-${currentService.id}`}>Type</FormLabel>
                <Select value={field.value || ""} onValueChange={field.onChange} disabled={isRam}>
                  <SelectTrigger id={`persistent-storage-type-${currentService.id}`}>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {(currentService.profile.storage[storageIndex].isPersistent ? persistentStorageTypes : ephemeralStorageTypes).map(t => {
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
            name={`services.${serviceIndex}.profile.storage.${storageIndex}.mount`}
            render={({ field }) => (
              <FormInput
                type="text"
                label={
                  <div className="inline-flex items-center">
                    Mount
                    <CustomTooltip
                      title={
                        <>
                          The path to mount the volume to.
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
      <AddStorageButton services={services} serviceIndex={serviceIndex} storageIndex={storageIndex} control={control} appendStorage={appendStorage} />
    </FormPaper>
  );
};
