"use client";
import { ReactNode } from "react";
import { Control, Controller } from "react-hook-form";
import { MdStorage } from "react-icons/md";
import { InfoCircle } from "iconoir-react";

import { RentGpusFormValues, SdlBuilderFormValues, Service } from "@src/types";
import { persistentStorageTypes, storageUnits } from "../shared/akash/units";
import {
  Checkbox,
  FormDescription,
  FormItem,
  Label,
  Input,
  InputWithIcon,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Slider,
  CustomTooltip
} from "@akashnetwork/ui/components";
import { FormPaper } from "./FormPaper";

type Props = {
  currentService: Service;
  serviceIndex: number;
  children?: ReactNode;
  control: Control<SdlBuilderFormValues | RentGpusFormValues, any>;
};

export const PersistentStorage: React.FunctionComponent<Props> = ({ currentService, serviceIndex, control }) => {
  return (
    <FormPaper>
      <Controller
        control={control}
        name={`services.${serviceIndex}.profile.persistentStorage`}
        rules={{
          min: 1,
          validate: v => {
            if (!v) return "Storage amount is required.";
            return true;
          }
        }}
        render={({ field, fieldState }) => (
          <FormItem
          // className={cx(classes.formControl, classes.textField)}
          // variant="standard"
          // sx={{ marginBottom: "0 !important" }}
          // error={!!fieldState.error}
          >
            <div className="flex items-start justify-between sm:flex-row sm:items-center">
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
                <div className="mt-2 flex items-center sm:mt-0">
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
                    name={`services.${serviceIndex}.profile.persistentStorageUnit`}
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
              )}
            </div>

            {currentService.profile.hasPersistentStorage && (
              <Slider
                value={[field.value || 0]}
                min={1}
                max={512}
                step={1}
                // valueLabelDisplay="auto"
                onValueChange={newValue => field.onChange(newValue)}
                className="pt-2"
              />
            )}

            {!!fieldState.error && <FormDescription>{fieldState.error.message}</FormDescription>}
          </FormItem>
        )}
      />

      {currentService.profile.hasPersistentStorage && (
        <div>
          <div className="mt-4 flex items-start">
            <Controller
              control={control}
              name={`services.${serviceIndex}.profile.persistentStorageParam.name`}
              rules={{
                required: "Name is required.",
                validate: value => {
                  const hasValidChars = /^[a-z0-9-]+$/.test(value);
                  const hasValidStartingChar = /^[a-z]/.test(value);
                  const hasValidEndingChar = !value.endsWith("-");

                  if (!hasValidChars) {
                    return "Invalid storage name. It must only be lower case letters, numbers and dashes.";
                  } else if (!hasValidStartingChar) {
                    return "Invalid starting character. It can only start with a lowercase letter.";
                  } else if (!hasValidEndingChar) {
                    return "Invalid ending character. It can only end with a lowercase letter or number";
                  }

                  return true;
                }
              }}
              render={({ field, fieldState }) => (
                <InputWithIcon
                  type="text"
                  color="secondary"
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
                  // error={!!fieldState.error}
                  error={fieldState.error?.message}
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
            <Controller
              control={control}
              name={`services.${serviceIndex}.profile.persistentStorageParam.type`}
              render={({ field }) => (
                <FormItem className="w-full basis-[40%]">
                  <Label htmlFor={`persistent-storage-type-${currentService.id}`}>Type</Label>
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
                </FormItem>
              )}
            />

            <Controller
              control={control}
              name={`services.${serviceIndex}.profile.persistentStorageParam.mount`}
              rules={{ required: "Mount is required.", pattern: { value: /^\/.*$/, message: "Mount must be an absolute path." } }}
              render={({ field, fieldState }) => (
                <InputWithIcon
                  type="text"
                  color="secondary"
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
                  error={fieldState.error?.message}
                  onChange={event => field.onChange(event.target.value)}
                  className="ml-2 w-full"
                  // helperText={!!fieldState.error && fieldState.error.message}
                />
              )}
            />
          </div>
        </div>
      )}
    </FormPaper>
  );
};
