import type { FC } from "react";
import { useCallback, useId, useMemo } from "react";
import { useController, useFieldArray, useFormContext } from "react-hook-form";
import {
  Button,
  CollapsibleCard,
  Field,
  FieldContent,
  FieldError,
  FieldLabel,
  QuantityStepper,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  useFieldError
} from "@akashnetwork/ui/components";
import { GpuIcon, LockIcon, PlusIcon, TrashIcon, XIcon } from "lucide-react";

import { SearchableSelect } from "@src/components/shared/SearchableSelect/SearchableSelect";
import { useGpuModels } from "@src/queries/useGpuQuery";
import type { SdlBuilderFormValuesType } from "@src/types";
import type { GpuVendor } from "@src/types/gpu";
import { gpuVendors as fallbackVendors, prioritizeGpuModels } from "@src/utils/akash/gpu";
import { validationConfig } from "@src/utils/akash/units";
import { defaultGpuModel } from "@src/utils/sdl/data";
import { gpuTooltip } from "../cardTooltips";
import { SELECT_TRUNCATE_VALUE } from "../selectStyles";
import { UnlockGpusButton } from "../UnlockGpusButton/UnlockGpusButton";

export const DEPENDENCIES = { CollapsibleCard, useGpuModels, useFieldError, GpuModelFields };

type Props = {
  serviceIndex: number;
  /** While the pane is locked the enable switch and every GPU input are disabled so the configured GPU stays viewable but read-only. */
  locked?: boolean;
  /** Returns whether a GPU model is blocked for the current (trial) user; blocked models lock in the model picker. */
  isBlockedModel?: (vendor?: string | null, model?: string | null) => boolean;
  /** Opens the add-credits (unlock) sheet owned by the HardwareSection. */
  onUnlock?: () => void;
  dependencies?: typeof DEPENDENCIES;
};

/**
 * Hardware "GPU" card. A header switch toggles `profile.hasGpu` (the SDL emits a
 * GPU block only while enabled); enabling defaults the count to at least one and
 * keeps at least one GPU collection. The body holds a count stepper followed by
 * one collection per `profile.gpuModels` entry — vendor, model, memory and
 * interface selects — plus an "Add GPU" button. Each collection after the first
 * can be removed.
 *
 * While the trial restriction is in force, blocked GPU models render locked in the
 * model picker (with an unlock CTA); allowed models stay selectable and the enable
 * switch itself is never disabled by the restriction.
 */
export const GpuCard: FC<Props> = ({ serviceIndex, locked = false, isBlockedModel = () => false, onUnlock, dependencies: d = DEPENDENCIES }) => {
  const { control, setValue, getValues } = useFormContext<SdlBuilderFormValuesType>();
  const { data: gpuModels, isLoading: isLoadingModels, isError: isModelsError } = d.useGpuModels();

  const hasGpu = useController({ control, name: `services.${serviceIndex}.profile.hasGpu` });

  const { fields, append, remove } = useFieldArray({ control, name: `services.${serviceIndex}.profile.gpuModels`, keyName: "id" });

  const toggleGpu = useCallback(
    (checked: boolean) => {
      hasGpu.field.onChange(checked);
      if (checked) {
        if (getValues(`services.${serviceIndex}.profile.gpu`) === 0) {
          setValue(`services.${serviceIndex}.profile.gpu`, 1, { shouldValidate: true, shouldDirty: true });
        }
        if (fields.length === 0) {
          append({ ...defaultGpuModel }, { shouldFocus: false });
        }
      } else {
        setValue(`services.${serviceIndex}.profile.gpu`, 0, { shouldValidate: true, shouldDirty: true });
      }
    },
    [hasGpu.field, getValues, setValue, serviceIndex, fields.length, append]
  );

  const hasReachedGpuLimit = fields.length >= validationConfig.maxGpuAmount;
  const addGpuModel = useCallback(() => {
    if (fields.length >= validationConfig.maxGpuAmount) return;
    append({ ...defaultGpuModel }, { shouldFocus: false });
  }, [append, fields.length]);

  return (
    <d.CollapsibleCard
      locked={locked}
      title="GPU"
      icon={<GpuIcon className="h-4 w-4" />}
      infoTooltip={gpuTooltip}
      isToggled={!!hasGpu.field.value}
      onToggle={toggleGpu}
      toggleAriaLabel="Enable GPU"
      toggleDisabled={locked}
    >
      {hasGpu.field.value ? (
        <fieldset disabled={locked} className="flex flex-col gap-4 border-0 p-0">
          <GpuCountField serviceIndex={serviceIndex} locked={locked} dependencies={d} />

          {fields.map((field, index) => (
            <d.GpuModelFields
              key={field.id}
              serviceIndex={serviceIndex}
              gpuIndex={index}
              gpuVendors={gpuModels}
              isLoading={isLoadingModels}
              isError={isModelsError}
              isBlockedModel={isBlockedModel}
              onUnlock={onUnlock}
              locked={locked}
              onRemove={index === 0 ? undefined : () => remove(index)}
            />
          ))}

          {!locked && (
            <div className="flex justify-end">
              <button
                type="button"
                aria-label="Add GPU"
                onClick={addGpuModel}
                disabled={hasReachedGpuLimit}
                className="flex w-full items-center justify-center rounded-md py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-50 dark:hover:bg-black"
              >
                <PlusIcon className="h-4 w-4" />
              </button>
            </div>
          )}
        </fieldset>
      ) : (
        <p className="text-sm text-muted-foreground">GPU is off.</p>
      )}
    </d.CollapsibleCard>
  );
};

const GpuCountField: FC<{ serviceIndex: number; locked?: boolean; dependencies: typeof DEPENDENCIES }> = ({
  serviceIndex,
  locked = false,
  dependencies: d
}) => {
  const { control } = useFormContext<SdlBuilderFormValuesType>();
  const { error: gpuError } = d.useFieldError(`services.${serviceIndex}.profile.gpu`);
  const errorId = useId();
  const gpu = useController({ control, name: `services.${serviceIndex}.profile.gpu` });

  return (
    <Field className="gap-2">
      <FieldLabel>Count</FieldLabel>
      <FieldContent>
        <QuantityStepper
          label="GPU count"
          className="self-start"
          value={gpu.field.value ?? 0}
          min={1}
          max={validationConfig.maxGpuAmount}
          aria-describedby={gpuError ? errorId : undefined}
          disabled={locked}
          onChange={gpu.field.onChange}
        />
        <FieldError id={errorId}>{gpuError}</FieldError>
      </FieldContent>
    </Field>
  );
};

type GpuModelFieldsProps = {
  serviceIndex: number;
  gpuIndex: number;
  gpuVendors: GpuVendor[] | undefined;
  isLoading?: boolean;
  isError?: boolean;
  /** Returns whether a `vendor`/`model` is blocked for the current (trial) user; blocked models lock in the picker. */
  isBlockedModel: (vendor?: string | null, model?: string | null) => boolean;
  /** Opens the add-credits (unlock) sheet, offered when the picked vendor exposes any blocked model. */
  onUnlock?: () => void;
  /** While the pane is locked every input is disabled so the configured GPU stays viewable but read-only. */
  locked?: boolean;
  onRemove?: () => void;
};

/**
 * A single GPU collection: vendor, model, memory and interface selects. Picking
 * a vendor resets the downstream selections, and picking a model preselects the
 * memory/interface when the model offers only one option (mirroring the legacy
 * GPU control). Memory and interface stay disabled until a model is picked.
 *
 * While the GPU model catalog is loading a spinner replaces the selects, and a
 * failed fetch shows a short retryless message, so the model/memory/interface
 * selects never sit permanently dead with no explanation (matching the legacy
 * GPU control's "Loading GPU models…" affordance).
 */
function GpuModelFields({ serviceIndex, gpuIndex, gpuVendors, isLoading, isError, isBlockedModel, onUnlock, locked = false, onRemove }: GpuModelFieldsProps) {
  const { control, setValue } = useFormContext<SdlBuilderFormValuesType>();
  const basePath = `services.${serviceIndex}.profile.gpuModels.${gpuIndex}` as const;

  const vendor = useController({ control, name: `${basePath}.vendor` });
  const name = useController({ control, name: `${basePath}.name` });
  const memory = useController({ control, name: `${basePath}.memory` });
  const gpuInterface = useController({ control, name: `${basePath}.interface` });

  const vendorOptions = useMemo(
    () =>
      gpuVendors ? gpuVendors.map(v => ({ value: v.name, label: v.displayName ?? v.name })) : fallbackVendors.map(v => ({ value: v.value, label: v.label })),
    [gpuVendors]
  );
  const models = useMemo(() => gpuVendors?.find(v => v.name === vendor.field.value)?.models ?? [], [gpuVendors, vendor.field.value]);
  const selectedModel = useMemo(() => models.find(m => m.name === name.field.value), [models, name.field.value]);
  const memorySizes = selectedModel?.memory ?? [];
  const interfaces = selectedModel?.interface ?? [];

  const selectGpuVendor = useCallback(
    (value: string) => {
      vendor.field.onChange(value);
      setValue(`${basePath}.name`, "", { shouldValidate: true, shouldDirty: true });
      setValue(`${basePath}.memory`, "", { shouldValidate: true, shouldDirty: true });
      setValue(`${basePath}.interface`, "", { shouldValidate: true, shouldDirty: true });
    },
    [vendor.field, setValue, basePath]
  );

  const selectGpuModel = useCallback(
    (value: string) => {
      const picked = models.find(m => m.name === value);
      name.field.onChange(value);
      setValue(`${basePath}.memory`, onlyOption(picked?.memory), { shouldValidate: true, shouldDirty: true });
      setValue(`${basePath}.interface`, onlyOption(picked?.interface), { shouldValidate: true, shouldDirty: true });
    },
    [models, name.field, setValue, basePath]
  );

  const clearModel = useCallback(() => {
    name.field.onChange("");
    setValue(`${basePath}.memory`, "", { shouldValidate: true, shouldDirty: true });
    setValue(`${basePath}.interface`, "", { shouldValidate: true, shouldDirty: true });
  }, [name.field, setValue, basePath]);

  const selectModel = useCallback(
    (value: string) => {
      if (value) {
        selectGpuModel(value);
      } else {
        clearModel();
      }
    },
    [selectGpuModel, clearModel]
  );

  const modelOptions = useMemo(
    () =>
      prioritizeGpuModels(models).map(model => {
        const blocked = isBlockedModel(vendor.field.value, model.name);
        const label = model.displayName ?? model.name;
        return {
          value: model.name,
          disabled: blocked,
          keywords: [label],
          label: (
            <span className="flex items-center gap-1.5">
              {label}
              {blocked && <LockIcon className="h-3 w-3 shrink-0 text-muted-foreground" aria-label="Requires credits" />}
            </span>
          )
        };
      }),
    [models, isBlockedModel, vendor.field.value]
  );

  return (
    <div role="group" aria-label={`GPU ${gpuIndex + 1}`} className="flex flex-col gap-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase text-muted-foreground">GPU {gpuIndex + 1}</span>
        {onRemove && (
          <Button size="icon" type="button" variant="ghost" className="h-6 w-6" aria-label={`Remove GPU ${gpuIndex + 1}`} disabled={locked} onClick={onRemove}>
            <TrashIcon className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Field className="gap-2">
        <FieldLabel>Vendor</FieldLabel>
        <FieldContent>
          <Select value={vendor.field.value || ""} onValueChange={selectGpuVendor} disabled={locked}>
            <SelectTrigger aria-label="GPU vendor" className={`h-9 ${SELECT_TRUNCATE_VALUE}`}>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {vendorOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldContent>
      </Field>

      {isLoading ? (
        <div className="flex items-center gap-2 py-1">
          <Spinner size="small" />
          <span className="text-sm text-muted-foreground">Loading GPU models...</span>
        </div>
      ) : isError ? (
        <p className="py-1 text-sm text-destructive">Failed to load GPU models. You can still deploy without specifying a model.</p>
      ) : (
        <>
          <Field className="gap-2">
            <FieldLabel>Model</FieldLabel>
            <FieldContent>
              <SearchableSelect
                value={name.field.value || ""}
                onChange={selectModel}
                options={modelOptions}
                ariaLabel="GPU model"
                searchLabel="Search GPU models"
                searchPlaceholder="Search models..."
                notFoundMessage="No models found."
                emptyOption={{ value: "", label: "Any model" }}
                renderValue={modelName => models.find(model => model.name === modelName)?.displayName ?? modelName}
                disabled={locked || models.length === 0}
                triggerClassName="h-9"
              />
            </FieldContent>
          </Field>

          <Field className="gap-2">
            <FieldLabel>Memory</FieldLabel>
            <FieldContent>
              <ClearableSelect clearLabel="Clear GPU memory" onClear={!locked && memory.field.value ? () => memory.field.onChange("") : undefined}>
                <Select value={memory.field.value || ""} onValueChange={memory.field.onChange} disabled={locked || !selectedModel}>
                  <SelectTrigger aria-label="GPU memory" className={`h-9 ${SELECT_TRUNCATE_VALUE}`}>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {memorySizes.map(size => (
                      <SelectItem key={size} value={size}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ClearableSelect>
            </FieldContent>
          </Field>

          <Field className="gap-2">
            <FieldLabel>Interface</FieldLabel>
            <FieldContent>
              <ClearableSelect
                clearLabel="Clear GPU interface"
                onClear={!locked && gpuInterface.field.value ? () => gpuInterface.field.onChange("") : undefined}
              >
                <Select value={gpuInterface.field.value || ""} onValueChange={gpuInterface.field.onChange} disabled={locked || !selectedModel}>
                  <SelectTrigger aria-label="GPU interface" className={`h-9 ${SELECT_TRUNCATE_VALUE}`}>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {interfaces.map(option => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ClearableSelect>
            </FieldContent>
          </Field>

          {models.some(model => isBlockedModel(vendor.field.value, model.name)) && <UnlockGpusButton onUnlock={onUnlock} />}
        </>
      )}
    </div>
  );
}

type ClearableSelectProps = {
  /** When set, a clear button is overlaid on the trigger (before the chevron). */
  onClear?: () => void;
  clearLabel: string;
  children: React.ReactNode;
};

/**
 * Overlays a clear button on a Select's trigger without nesting a button inside
 * it (which would be invalid markup and break the combobox). The button sits
 * absolutely to the right, before the chevron, and suppresses `pointer-down` so
 * clicking it doesn't open the Select (Radix opens the trigger on pointer-down).
 */
const ClearableSelect: FC<ClearableSelectProps> = ({ onClear, clearLabel, children }) => (
  <div className="relative">
    {children}
    {onClear && (
      <button
        type="button"
        aria-label={clearLabel}
        className="absolute right-8 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
        onPointerDown={event => event.preventDefault()}
        onClick={onClear}
      >
        <XIcon className="h-3.5 w-3.5" />
      </button>
    )}
  </div>
);

/** Returns the single available option (so it can be preselected), otherwise an empty value. */
function onlyOption(options: string[] | undefined): string {
  return options?.length === 1 ? options[0] : "";
}
