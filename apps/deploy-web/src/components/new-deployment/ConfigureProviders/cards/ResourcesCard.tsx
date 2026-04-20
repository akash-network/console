"use client";
import type { FC } from "react";
import type { Control } from "react-hook-form";
import { Controller, useFieldArray } from "react-hook-form";
import { MdSpeed } from "react-icons/md";
import {
  Checkbox,
  FormField,
  FormItem,
  FormMessage,
  Input,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";

import type { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { memoryUnits, persistentStorageTypes, storageUnits, validationConfig } from "@src/utils/akash/units";
import { defaultPersistentStorage } from "@src/utils/sdl/data";
import { CollapsibleCard } from "./CollapsibleCard";

type Props = {
  control: Control<SdlBuilderFormValuesType>;
  currentService: ServiceType;
  serviceIndex: number;
};

export const ResourcesCard: FC<Props> = ({ control, currentService, serviceIndex }) => {
  const storage0 = currentService.profile.storage?.[0];

  const {
    fields: storageFields,
    append: appendStorage,
    remove: removeStorage
  } = useFieldArray({
    control,
    name: `services.${serviceIndex}.profile.storage`,
    keyName: "id"
  });

  const persistentStorages = storageFields.slice(1);
  const persistentCount = persistentStorages.length;

  const cpuPart = `${currentService.profile.cpu} vCPU`;
  const memPart = `${currentService.profile.ram}${currentService.profile.ramUnit || "Mi"}`;
  const storagePart = storage0 ? `${storage0.size}${storage0.unit || "Gi"}` : "1Gi";
  const countPart = (currentService.count || 1) > 1 ? ` · ×${currentService.count}` : "";
  const persistPart = persistentCount > 0 ? ` · ${persistentCount}V` : "";
  const summary = `${cpuPart} · ${memPart} · ${storagePart}${countPart}${persistPart}`;

  return (
    <CollapsibleCard icon={<MdSpeed className="h-3.5 w-3.5" />} title="Resources" summary={summary}>
      <div className="space-y-2.5">
        {/* CPU */}
        <FormField
          control={control}
          name={`services.${serviceIndex}.profile.cpu`}
          render={({ field, fieldState }) => (
            <FormItem>
              <div className="flex items-center gap-3">
                <label className="w-20 text-xs text-muted-foreground">vCPU</label>
                <Input
                  type="number"
                  color="secondary"
                  error={!!fieldState.error}
                  value={field.value || ""}
                  onChange={event => field.onChange(parseFloat(event.target.value))}
                  min={0.1}
                  step={0.1}
                  max={validationConfig.maxCpuAmount}
                  inputClassName="h-8 w-[80px]"
                />
                <span className="rounded border border-border px-2 py-1 text-[10px] font-medium text-muted-foreground">vCPU</span>
              </div>
              <FormMessage className={cn({ "pt-2": !!fieldState.error })} />
            </FormItem>
          )}
        />

        {/* Memory */}
        <FormField
          control={control}
          name={`services.${serviceIndex}.profile.ram`}
          render={({ field, fieldState }) => (
            <FormItem>
              <div className="flex items-center gap-3">
                <label className="w-20 text-xs text-muted-foreground">Memory</label>
                <Input
                  type="number"
                  color="secondary"
                  error={!!fieldState.error}
                  value={field.value || ""}
                  onChange={event => field.onChange(parseFloat(event.target.value))}
                  min={1}
                  step={1}
                  inputClassName="h-8 w-[80px]"
                />
                <Controller
                  control={control}
                  name={`services.${serviceIndex}.profile.ramUnit`}
                  defaultValue=""
                  render={({ field: unitField }) => (
                    <Select value={unitField.value?.toLowerCase() || ""} onValueChange={unitField.onChange}>
                      <SelectTrigger className="h-8 w-[65px]">
                        <SelectValue placeholder="Mi" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {memoryUnits.map(t => (
                            <SelectItem key={t.id} value={t.suffix.toLowerCase()}>
                              {t.suffix}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Ephemeral Storage */}
        <FormField
          control={control}
          name={`services.${serviceIndex}.profile.storage.0.size`}
          render={({ field, fieldState }) => (
            <FormItem>
              <div className="flex items-center gap-3">
                <label className="w-20 text-xs text-muted-foreground">Storage</label>
                <Input
                  type="number"
                  color="secondary"
                  error={!!fieldState.error}
                  value={field.value || ""}
                  onChange={event => field.onChange(parseFloat(event.target.value))}
                  min={1}
                  step={1}
                  inputClassName="h-8 w-[80px]"
                />
                <Controller
                  control={control}
                  name={`services.${serviceIndex}.profile.storage.0.unit`}
                  defaultValue=""
                  render={({ field: unitField }) => (
                    <Select value={unitField.value?.toLowerCase() || ""} onValueChange={unitField.onChange}>
                      <SelectTrigger className="h-8 w-[65px]">
                        <SelectValue placeholder="Gi" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {storageUnits.map(t => (
                            <SelectItem key={t.id} value={t.suffix.toLowerCase()}>
                              {t.suffix}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Service Count */}
        <FormField
          control={control}
          name={`services.${serviceIndex}.count`}
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center gap-3">
                <label className="w-20 text-xs text-muted-foreground">Replicas</label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  step={1}
                  value={field.value}
                  onChange={e => field.onChange(parseInt(e.target.value) || 1)}
                  inputClassName="h-8 w-[80px]"
                />
              </div>
            </FormItem>
          )}
        />

        {/* Persistent Storage */}
        <div className="space-y-2 pt-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">Persistent storage</span>
            <span className="font-mono text-[11px] text-muted-foreground">
              {persistentCount > 0 ? `${persistentCount} volume${persistentCount > 1 ? "s" : ""}` : "None"}
            </span>
          </div>

          {persistentStorages.map((storageField, idx) => {
            const storageIndex = idx + 1;
            const storage = currentService.profile.storage[storageIndex];
            const isRam = storage?.type === "ram";

            return (
              <div key={storageField.id} className="space-y-3 rounded-md border border-border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">{isRam ? "RAM Storage" : "Persistent Storage"}</span>
                  <button type="button" onClick={() => removeStorage(storageIndex)} className="text-[10px] text-destructive hover:underline">
                    Remove
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <label className="text-xs text-muted-foreground">Size</label>
                  <FormField
                    control={control}
                    name={`services.${serviceIndex}.profile.storage.${storageIndex}.size`}
                    render={({ field, fieldState }) => (
                      <Input
                        type="number"
                        color="secondary"
                        error={!!fieldState.error}
                        value={field.value || ""}
                        onChange={event => field.onChange(parseFloat(event.target.value))}
                        min={1}
                        step={1}
                        inputClassName="h-8 w-[80px]"
                      />
                    )}
                  />
                  <Controller
                    control={control}
                    name={`services.${serviceIndex}.profile.storage.${storageIndex}.unit`}
                    defaultValue=""
                    render={({ field: unitField }) => (
                      <Select value={unitField.value?.toLowerCase() || ""} onValueChange={unitField.onChange}>
                        <SelectTrigger className="h-8 w-[65px]">
                          <SelectValue placeholder="Gi" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {storageUnits.map(t => (
                              <SelectItem key={t.id} value={t.suffix.toLowerCase()}>
                                {t.suffix}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <FormField
                  control={control}
                  name={`services.${serviceIndex}.profile.storage.${storageIndex}.name`}
                  render={({ field, fieldState }) => (
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Name</label>
                      <Input
                        type="text"
                        value={field.value || ""}
                        error={!!fieldState.error}
                        onChange={event => field.onChange(event.target.value)}
                        placeholder="e.g. data"
                      />
                      {fieldState.error && <p className="text-xs text-destructive">{fieldState.error.message}</p>}
                    </div>
                  )}
                />

                {!isRam && (
                  <FormField
                    control={control}
                    name={`services.${serviceIndex}.profile.storage.${storageIndex}.type`}
                    render={({ field }) => (
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Type</label>
                        <Select value={field.value || ""} onValueChange={field.onChange}>
                          <SelectTrigger className="w-[120px]">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {persistentStorageTypes.map(t => (
                                <SelectItem key={t.id} value={t.className}>
                                  {t.name}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  />
                )}

                <FormField
                  control={control}
                  name={`services.${serviceIndex}.profile.storage.${storageIndex}.mount`}
                  render={({ field, fieldState }) => (
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Mount path</label>
                      <Input
                        type="text"
                        value={field.value || ""}
                        error={!!fieldState.error}
                        onChange={event => field.onChange(event.target.value)}
                        placeholder="/mnt/data"
                      />
                      {fieldState.error && <p className="text-xs text-destructive">{fieldState.error.message}</p>}
                    </div>
                  )}
                />

                {!isRam && (
                  <Controller
                    control={control}
                    name={`services.${serviceIndex}.profile.storage.${storageIndex}.isReadOnly`}
                    render={({ field }) => (
                      <div className="flex items-center gap-2">
                        <Checkbox checked={field.value || false} onCheckedChange={field.onChange} id={`readOnly-${serviceIndex}-${storageIndex}`} />
                        <label htmlFor={`readOnly-${serviceIndex}-${storageIndex}`} className="text-xs text-muted-foreground">
                          Read only
                        </label>
                      </div>
                    )}
                  />
                )}
              </div>
            );
          })}

          <button type="button" onClick={() => appendStorage(defaultPersistentStorage)} className="text-xs font-medium text-primary hover:underline">
            + Add persistent storage
          </button>
        </div>
      </div>
    </CollapsibleCard>
  );
};
