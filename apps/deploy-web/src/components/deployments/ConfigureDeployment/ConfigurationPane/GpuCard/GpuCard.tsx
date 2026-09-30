import type { FC, ReactNode } from "react";
import { useCallback, useId, useMemo, useState } from "react";
import { useController, useFieldArray, useFormContext, useWatch } from "react-hook-form";
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
import { ArrowRightIcon, GpuIcon, LockIcon, MessageSquareIcon, PlusIcon, TrashIcon, XIcon } from "lucide-react";

import { SearchableSelect } from "@src/components/shared/SearchableSelect/SearchableSelect";
import { useServices } from "@src/context/ServicesProvider";
import { useGpuModels } from "@src/queries/useGpuQuery";
import type { AvailableGpuVendor } from "@src/queries/usePlacementOptions";
import { usePlacementOptions } from "@src/queries/usePlacementOptions";
import type { SdlBuilderFormValuesType } from "@src/types";
import type { GpuVendor } from "@src/types/gpu";
import type { PinnedGpu } from "@src/utils/akash/gpu";
import {
  findUnavailableGpuModels,
  gpuVendors as fallbackVendors,
  listGpuInterfaceOptions,
  listGpuMemoryOptions,
  narrowFallbackVendors,
  narrowGpuVendorsToAvailable,
  prioritizeGpuModels,
  withPinnedGpu
} from "@src/utils/akash/gpu";
import { validationConfig } from "@src/utils/akash/units";
import { formatProviderCount } from "@src/utils/providerUtils";
import { defaultGpuModel } from "@src/utils/sdl/data";
import { describeCurrentConfiguration } from "../../HardwareRequestDialog/currentConfiguration";
import { HardwareRequestDialog } from "../../HardwareRequestDialog/HardwareRequestDialog";
import { gpuTooltip } from "../cardTooltips";
import { GpuInterconnectFields } from "../GpuInterconnectFields/GpuInterconnectFields";
import { SELECT_TRUNCATE_VALUE } from "../selectStyles";
import { UnlockGpusButton } from "../UnlockGpusButton/UnlockGpusButton";
import { useServiceGpu } from "../useServiceGpu/useServiceGpu";
import { summarizeGpu } from "./gpuSummary";

export const DEPENDENCIES = {
  CollapsibleCard,
  useGpuModels,
  usePlacementOptions,
  useFieldError,
  useServices,
  GpuModelFields,
  GpuInterconnectFields,
  HardwareRequestDialog
};

type Props = {
  serviceIndex: number;
  /** While the pane is locked every GPU input is disabled so the configured GPU stays viewable but read-only. */
  locked?: boolean;
  /** Returns whether a GPU model is blocked for the current (trial) user; blocked models lock in the model picker. */
  isBlockedModel?: (vendor?: string | null, model?: string | null) => boolean;
  /** A trial wallet can't opt into the GPU interconnect. */
  isInterconnectTrialBlocked?: boolean;
  /** Opens the add-credits (unlock) sheet owned by the HardwareSection. */
  onUnlock?: () => void;
  dependencies?: typeof DEPENDENCIES;
};

type ModelFieldsSharedProps = Omit<GpuModelFieldsProps, "gpuIndex" | "isGpuOn" | "countField" | "onModelPick" | "onRemove">;

/** A GPU count of 0 means no GPU, so the first model picker and the count stay visible while the rest of the GPU settings wait for a count. */
export const GpuCard: FC<Props> = ({
  serviceIndex,
  locked = false,
  isBlockedModel = () => false,
  isInterconnectTrialBlocked = false,
  onUnlock,
  dependencies: d = DEPENDENCIES
}) => {
  const { control, getValues } = useFormContext<SdlBuilderFormValuesType>();
  const [requestedGpuModel, setRequestedGpuModel] = useState<string | null>(null);
  const { data: gpuCatalog, isLoading: isLoadingModels, isError: isModelsError } = d.useGpuModels();
  const { data: placementOptions } = d.usePlacementOptions();
  const availableVendors = narrowGpuVendorsToAvailable(gpuCatalog, placementOptions?.gpus);
  const serviceGpu = useServiceGpu(serviceIndex);
  const [hasGpu, gpu, watchedModels] = useWatch({
    control,
    name: [`services.${serviceIndex}.profile.hasGpu`, `services.${serviceIndex}.profile.gpu`, `services.${serviceIndex}.profile.gpuModels`]
  });
  const { fields, append, remove } = useFieldArray({ control, name: `services.${serviceIndex}.profile.gpuModels`, keyName: "id" });
  const isGpuOn = serviceGpu.count > 0;

  const hasReachedModelLimit = fields.length >= validationConfig.maxGpuAmount;
  const addAlternativeModel = useCallback(() => {
    if (fields.length >= validationConfig.maxGpuAmount) return;
    append({ ...defaultGpuModel }, { shouldFocus: false });
  }, [append, fields.length]);

  const sharedModelProps: ModelFieldsSharedProps = {
    serviceIndex,
    gpuVendors: availableVendors,
    gpuCatalog,
    availableGpus: placementOptions?.gpus,
    isLoading: isLoadingModels,
    isError: isModelsError && !availableVendors,
    isBlockedModel,
    onUnlock,
    onRequestGpu: setRequestedGpuModel,
    locked,
    dependencies: d
  };
  const countField = (
    <GpuCountField serviceIndex={serviceIndex} locked={locked} count={serviceGpu.count} onCountChange={serviceGpu.setCount} dependencies={d} />
  );

  return (
    <>
      <d.CollapsibleCard
        locked={locked}
        title="GPU"
        icon={<GpuIcon className="h-4 w-4" />}
        infoTooltip={gpuTooltip}
        summary={summarizeGpu({ hasGpu, gpu, gpuModels: watchedModels }, gpuCatalog)}
        summaryVisibility="always"
      >
        <fieldset disabled={locked} className="flex flex-col gap-4 border-0 p-0">
          <p className="text-sm text-muted-foreground">Add accelerators for inference, training or rendering.</p>

          {fields.length > 0 ? (
            <d.GpuModelFields {...sharedModelProps} key={fields[0].id} gpuIndex={0} isGpuOn={isGpuOn} countField={countField} onModelPick={serviceGpu.enable} />
          ) : (
            <FirstGpuModelPicker {...sharedModelProps} countField={countField} onPick={serviceGpu.pickFirstModel} />
          )}

          {isGpuOn &&
            fields
              .slice(1)
              .map((field, offset) => (
                <d.GpuModelFields {...sharedModelProps} key={field.id} gpuIndex={offset + 1} isGpuOn onRemove={() => remove(offset + 1)} />
              ))}

          {isGpuOn && !locked && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addAlternativeModel}
              disabled={hasReachedModelLimit}
              className="gap-1.5 self-start text-muted-foreground"
            >
              <PlusIcon className="h-4 w-4" />
              Add another model
            </Button>
          )}

          <d.GpuInterconnectFields serviceIndex={serviceIndex} locked={locked} isTrialBlocked={isInterconnectTrialBlocked} onUnlock={onUnlock} />
        </fieldset>
      </d.CollapsibleCard>

      {requestedGpuModel !== null && (
        <d.HardwareRequestDialog
          initialGpuModel={requestedGpuModel}
          configuration={describeCurrentConfiguration(getValues(), serviceIndex, gpuCatalog)}
          onClose={() => setRequestedGpuModel(null)}
        />
      )}
    </>
  );
};

const GpuCountField: FC<{
  serviceIndex: number;
  locked?: boolean;
  count: number;
  onCountChange: (count: number) => void;
  dependencies: typeof DEPENDENCIES;
}> = ({ serviceIndex, locked = false, count, onCountChange, dependencies: d }) => {
  const { analyticsService } = d.useServices();
  const { error: gpuError } = d.useFieldError(`services.${serviceIndex}.profile.gpu`);
  const errorId = useId();

  function changeGpuCount(next: number) {
    analyticsService.track("configure_gpu_count_changed", { category: "deployments", count: next });
    onCountChange(next);
  }

  return (
    <Field className="gap-2">
      <FieldLabel>GPUs</FieldLabel>
      <FieldContent>
        <QuantityStepper
          label="GPUs"
          value={count}
          min={0}
          max={validationConfig.maxGpuAmount}
          aria-describedby={gpuError ? errorId : undefined}
          disabled={locked}
          onChange={changeGpuCount}
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
  gpuCatalog?: GpuVendor[];
  availableGpus?: AvailableGpuVendor[];
  isLoading?: boolean;
  isError?: boolean;
  /** Returns whether a `vendor`/`model` is blocked for the current (trial) user; blocked models lock in the picker. */
  isBlockedModel: (vendor?: string | null, model?: string | null) => boolean;
  /** Opens the add-credits (unlock) sheet, offered when the picked vendor exposes any blocked model. */
  onUnlock?: () => void;
  onRequestGpu: (gpuModel: string) => void;
  /** While the pane is locked every input is disabled so the configured GPU stays viewable but read-only. */
  locked?: boolean;
  /** The vendor, memory and interface of the first model wait for a GPU count. */
  isGpuOn: boolean;
  /** Rendered beside the first model's picker. */
  countField?: ReactNode;
  /** Runs on every pick, including a re-pick of the current model, so picking a model while the GPU is off turns it on. */
  onModelPick?: () => void;
  onRemove?: () => void;
  dependencies?: typeof DEPENDENCIES;
};

/** A spinner or error message stands in for the selects while the GPU catalog loads or fails, so they never sit disabled without explanation. */
function GpuModelFields({
  serviceIndex,
  gpuIndex,
  gpuVendors,
  gpuCatalog,
  availableGpus,
  isLoading,
  isError,
  isBlockedModel,
  onUnlock,
  onRequestGpu,
  locked = false,
  isGpuOn,
  countField,
  onModelPick,
  onRemove,
  dependencies: d = DEPENDENCIES
}: GpuModelFieldsProps) {
  const { control, setValue } = useFormContext<SdlBuilderFormValuesType>();
  const { analyticsService } = d.useServices();
  const basePath = `services.${serviceIndex}.profile.gpuModels.${gpuIndex}` as const;

  const vendor = useController({ control, name: `${basePath}.vendor` });
  const name = useController({ control, name: `${basePath}.name` });
  const memory = useController({ control, name: `${basePath}.memory` });
  const gpuInterface = useController({ control, name: `${basePath}.interface` });

  const choices = useGpuModelOptions({
    gpuVendors,
    gpuCatalog,
    availableGpus,
    isBlockedModel,
    pinned: { vendor: vendor.field.value, name: name.field.value, memory: memory.field.value, interface: gpuInterface.field.value }
  });

  const selectGpuVendor = useCallback(
    (value: string) => {
      vendor.field.onChange(value);
      setValue(`${basePath}.name`, "", { shouldValidate: true, shouldDirty: true });
      setValue(`${basePath}.memory`, "", { shouldValidate: true, shouldDirty: true });
      setValue(`${basePath}.interface`, "", { shouldValidate: true, shouldDirty: true });
    },
    [vendor.field, setValue, basePath]
  );

  /** A provider bids only on a GPU key it advertises verbatim, so memory and interface stay unpinned until the user asks for them. */
  const selectModel = useCallback(
    (value: string) => {
      onModelPick?.();
      if (value === name.field.value) {
        return;
      }
      name.field.onChange(value);
      memory.field.onChange("");
      gpuInterface.field.onChange("");
      if (value) {
        analyticsService.track("configure_gpu_type_selected", { category: "deployments", model: value, vendor: vendor.field.value });
      }
    },
    [onModelPick, name.field, memory.field, gpuInterface.field, analyticsService, vendor.field.value]
  );

  const isCatalogReady = !isLoading && !isError;

  const vendorField = isGpuOn && choices.showVendor && (
    <Field className="gap-2">
      <FieldLabel>Vendor</FieldLabel>
      <FieldContent>
        <Select value={vendor.field.value || ""} onValueChange={selectGpuVendor} disabled={locked}>
          <SelectTrigger aria-label="GPU vendor" className={`h-9 ${SELECT_TRUNCATE_VALUE}`}>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            {choices.vendorOptions.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldContent>
    </Field>
  );

  const modelField = (
    <GpuModelControl
      isLoading={isLoading}
      isError={isError}
      value={name.field.value || ""}
      onChange={selectModel}
      onRequestGpu={onRequestGpu}
      choices={choices}
      disabled={locked}
      emptyTriggerLabel={isGpuOn ? undefined : "Select"}
    />
  );

  const pinFields = isGpuOn && isCatalogReady && (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-3">
      <Field className="gap-2">
        <FieldLabel>Memory</FieldLabel>
        <FieldContent>
          <ClearableSelect clearLabel="Clear GPU memory" onClear={!locked && memory.field.value ? () => memory.field.onChange("") : undefined}>
            <Select value={memory.field.value || ""} onValueChange={memory.field.onChange} disabled={locked || !choices.selectedModel}>
              <SelectTrigger aria-label="GPU memory" className={`h-9 ${SELECT_TRUNCATE_VALUE}`}>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {choices.memorySizes.map(size => (
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
          <ClearableSelect clearLabel="Clear GPU interface" onClear={!locked && gpuInterface.field.value ? () => gpuInterface.field.onChange("") : undefined}>
            <Select value={gpuInterface.field.value || ""} onValueChange={gpuInterface.field.onChange} disabled={locked || !choices.selectedModel}>
              <SelectTrigger aria-label="GPU interface" className={`h-9 ${SELECT_TRUNCATE_VALUE}`}>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {choices.interfaces.map(option => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ClearableSelect>
        </FieldContent>
      </Field>
    </div>
  );

  const unlockButton = isCatalogReady && choices.hasBlockedModel && <UnlockGpusButton onUnlock={onUnlock} />;

  if (gpuIndex === 0) {
    return (
      <div className="flex flex-col gap-3">
        {vendorField ? (
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] items-end gap-3">
            {vendorField}
            {modelField}
            {countField}
          </div>
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
            {modelField}
            {countField}
          </div>
        )}
        {pinFields}
        {unlockButton}
      </div>
    );
  }

  return (
    <div role="group" aria-label={`Alternative model ${gpuIndex}`} className="flex flex-col gap-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase text-muted-foreground">Alternative model {gpuIndex}</span>
        {onRemove && (
          <Button
            size="icon"
            type="button"
            variant="ghost"
            className="h-6 w-6"
            aria-label={`Remove alternative model ${gpuIndex}`}
            disabled={locked}
            onClick={onRemove}
          >
            <TrashIcon className="h-4 w-4" />
          </Button>
        )}
      </div>
      {vendorField ? (
        <div className="grid grid-cols-2 items-end gap-3">
          {vendorField}
          {modelField}
        </div>
      ) : (
        modelField
      )}
      {pinFields}
      {unlockButton}
    </div>
  );
}

type FirstGpuModelPickerProps = ModelFieldsSharedProps & {
  countField: ReactNode;
  onPick: (name: string) => void;
};

/** Stands in for the first model while the service has no GPU entry, writing the whole entry on a pick so nothing registers a partial one. */
function FirstGpuModelPicker({
  gpuVendors,
  gpuCatalog,
  availableGpus,
  isLoading,
  isError,
  isBlockedModel,
  onUnlock,
  onRequestGpu,
  locked = false,
  countField,
  onPick
}: FirstGpuModelPickerProps) {
  const choices = useGpuModelOptions({ gpuVendors, gpuCatalog, availableGpus, isBlockedModel, pinned: { vendor: defaultGpuModel.vendor } });

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
        <GpuModelControl
          isLoading={isLoading}
          isError={isError}
          value=""
          onChange={onPick}
          onRequestGpu={onRequestGpu}
          choices={choices}
          disabled={locked}
          emptyTriggerLabel="Select"
        />
        {countField}
      </div>
      {!isLoading && !isError && choices.hasBlockedModel && <UnlockGpusButton onUnlock={onUnlock} />}
    </div>
  );
}

type GpuModelControlProps = {
  isLoading?: boolean;
  isError?: boolean;
  value: string;
  onChange: (value: string) => void;
  onRequestGpu: (gpuModel: string) => void;
  choices: GpuModelChoices;
  disabled: boolean;
  emptyTriggerLabel?: string;
};

function GpuModelControl({ isLoading, isError, value, onChange, onRequestGpu, choices, disabled, emptyTriggerLabel }: GpuModelControlProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-1">
        <Spinner size="small" />
        <span className="text-sm text-muted-foreground">Loading GPU models...</span>
      </div>
    );
  }

  if (isError) {
    return <p className="py-1 text-sm text-destructive">Failed to load GPU models. You can still deploy without specifying a model.</p>;
  }

  return (
    <Field className="gap-2">
      <FieldLabel>GPU model</FieldLabel>
      <FieldContent>
        <SearchableSelect
          value={value}
          onChange={onChange}
          options={choices.modelOptions}
          unavailableOptions={choices.unavailableModelOptions}
          ariaLabel="GPU model"
          searchLabel="Search GPU models"
          searchPlaceholder="Search GPUs..."
          notFoundMessage="No models found."
          optionsHeading={
            choices.isAvailabilityKnown
              ? { label: "Available", hintLabel: choices.hasFreeUnitCounts ? <AvailabilityColumnLabels /> : "Providers" }
              : { label: "All models" }
          }
          unavailableHeading="Others"
          emptyOption={{
            value: "",
            disabled: choices.anyModelBlocked,
            label: choices.anyModelBlocked ? (
              <span className="flex items-center gap-1.5">
                Any GPU
                <LockIcon className="h-3 w-3 shrink-0 text-muted-foreground" aria-label="Requires credits" />
              </span>
            ) : (
              "Any GPU"
            )
          }}
          emptyTriggerLabel={emptyTriggerLabel}
          renderValue={modelName => choices.listedModels.find(model => model.name === modelName)?.displayName ?? modelName}
          renderFooter={(search, { close }) => (
            <GpuRequestLink
              onClick={() => {
                close();
                onRequestGpu(search.trim());
              }}
            />
          )}
          disabled={disabled || choices.listedModels.length === 0}
          triggerClassName="h-9"
          contentClassName="w-[max(var(--radix-popover-trigger-width),22rem)]"
        />
      </FieldContent>
    </Field>
  );
}

function GpuRequestLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
    >
      <MessageSquareIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>
        Don&apos;t see the GPU you need? <span className="font-medium text-foreground">Contact us</span>
      </span>
      <ArrowRightIcon className="ml-auto h-4 w-4 shrink-0" aria-hidden="true" />
    </button>
  );
}

/** The column labels and every row's counts share these widths, so each count lines up under its label. */
const AVAILABILITY_COLUMNS = "grid grid-cols-[5.5rem_3rem] justify-items-end";

function AvailabilityColumnLabels() {
  return (
    <span className={AVAILABILITY_COLUMNS}>
      <span>Providers</span>
      <span>GPUs</span>
    </span>
  );
}

function AvailabilityHint({ providerCount, availableUnits }: { providerCount: number; availableUnits?: number }) {
  if (availableUnits === undefined) {
    return (
      <>
        <span aria-hidden="true" className="font-mono">
          {providerCount}
        </span>
        <span className="sr-only">{formatProviderCount(providerCount)}</span>
      </>
    );
  }

  return (
    <span className={AVAILABILITY_COLUMNS}>
      <span aria-hidden="true" className="font-mono">
        {providerCount}
      </span>
      <span aria-hidden="true" className="font-mono">
        {availableUnits}
      </span>
      <span className="sr-only">{`${formatFreeGpuCount(availableUnits)} on ${formatProviderCount(providerCount)}`}</span>
    </span>
  );
}

function formatFreeGpuCount(count: number): string {
  return `${count} free ${count === 1 ? "GPU" : "GPUs"}`;
}

type GpuModelChoices = ReturnType<typeof useGpuModelOptions>;

type GpuModelOptionsInput = {
  gpuVendors: GpuVendor[] | undefined;
  gpuCatalog?: GpuVendor[];
  availableGpus?: AvailableGpuVendor[];
  isBlockedModel: (vendor?: string | null, model?: string | null) => boolean;
  pinned: PinnedGpu;
};

function useGpuModelOptions({ gpuVendors, gpuCatalog, availableGpus, isBlockedModel, pinned }: GpuModelOptionsInput) {
  const { vendor, name, memory, interface: gpuInterface } = pinned;

  const offeredVendors = useMemo(
    () => withPinnedGpu(narrowFallbackVendors(gpuVendors, availableGpus, vendor), { vendor, name, memory, interface: gpuInterface }),
    [gpuVendors, availableGpus, vendor, name, memory, gpuInterface]
  );

  const vendorOptions = useMemo(
    () =>
      offeredVendors
        ? offeredVendors.map(offered => ({ value: offered.name, label: offered.displayName ?? offered.name }))
        : fallbackVendors.map(fallback => ({ value: fallback.value, label: fallback.label })),
    [offeredVendors]
  );
  /** The vendor question has a single answer while one vendor is available, so the step only appears when this entry needs it. */
  const showVendor = vendorOptions.length !== 1 || vendor !== vendorOptions[0].value;
  const offeredVendor = offeredVendors?.find(offered => offered.name === vendor);
  const vendorLabel = offeredVendor?.displayName ?? vendor?.toUpperCase() ?? "";
  const models = useMemo(() => offeredVendor?.models ?? [], [offeredVendor]);
  const unavailableModels = useMemo(() => findUnavailableGpuModels(gpuCatalog, availableGpus, { vendor, name }), [gpuCatalog, availableGpus, vendor, name]);
  const selectableModels = useMemo(
    () => models.filter(model => !unavailableModels.some(unavailableModel => unavailableModel.name === model.name)),
    [models, unavailableModels]
  );
  const listedModels = useMemo(() => [...selectableModels, ...unavailableModels], [selectableModels, unavailableModels]);
  const selectedModel = useMemo(() => models.find(model => model.name === name), [models, name]);
  const memorySizes = useMemo(() => listGpuMemoryOptions(selectedModel, { memory, interface: gpuInterface }), [selectedModel, memory, gpuInterface]);
  const interfaces = useMemo(() => listGpuInterfaceOptions(selectedModel, { memory, interface: gpuInterface }), [selectedModel, memory, gpuInterface]);

  /**
   * On a trial, "Any GPU" is locked too (not just specific blocked models): it only draws a usable bid if an
   * allowed-model provider happens to bid, otherwise the deployment spins with no explanation (CON-660). The
   * predicate treats the empty model as blocked when the vendor exposes any blocked model.
   */
  const anyModelBlocked = isBlockedModel(vendor, "");

  /** An API from before free GPUs were counted serves none, and the picker then shows the provider count alone. */
  const hasFreeUnitCounts = selectableModels.some(model => model.availableUnits !== undefined);

  const modelOptions = useMemo(
    () =>
      prioritizeGpuModels(selectableModels).map(model => {
        const blocked = isBlockedModel(vendor, model.name);
        const label = model.displayName ?? model.name;
        return {
          value: model.name,
          disabled: blocked,
          keywords: [label, vendorLabel],
          hint: model.providerCount === undefined ? undefined : <AvailabilityHint providerCount={model.providerCount} availableUnits={model.availableUnits} />,
          label: (
            <span className="flex items-center gap-1.5">
              {vendorLabel} {label}
              {blocked && <LockIcon className="h-3 w-3 shrink-0 text-muted-foreground" aria-label="Requires credits" />}
            </span>
          )
        };
      }),
    [selectableModels, isBlockedModel, vendor, vendorLabel]
  );

  const unavailableModelOptions = useMemo(
    () =>
      prioritizeGpuModels(unavailableModels).map(model => {
        const label = model.displayName ?? model.name;
        return {
          value: model.name,
          keywords: [label, vendorLabel],
          label: `${vendorLabel} ${label}`,
          hint: <AvailabilityHint providerCount={0} availableUnits={hasFreeUnitCounts ? 0 : undefined} />
        };
      }),
    [unavailableModels, vendorLabel, hasFreeUnitCounts]
  );

  const hasBlockedModel = selectableModels.some(model => isBlockedModel(vendor, model.name));

  return {
    isAvailabilityKnown: !!availableGpus?.length,
    hasFreeUnitCounts,
    vendorOptions,
    showVendor,
    listedModels,
    selectedModel,
    memorySizes,
    interfaces,
    anyModelBlocked,
    modelOptions,
    unavailableModelOptions,
    hasBlockedModel
  };
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
