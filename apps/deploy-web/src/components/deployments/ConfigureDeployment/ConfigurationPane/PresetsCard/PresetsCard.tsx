import type { FC } from "react";
import { Fragment, useCallback, useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@akashnetwork/ui/components";
import { LockIcon } from "lucide-react";

import { useServices } from "@src/context/ServicesProvider";
import type { SdlBuilderFormValuesType } from "@src/types";
import { SELECT_TRUNCATE_VALUE } from "../selectStyles";
import { UnlockGpusButton } from "../UnlockGpusButton/UnlockGpusButton";
import type { HardwarePreset, HardwarePresetGroup } from "./hardwarePresets";
import { applyPreset, detectPreset, formatPresetSpecs, HARDWARE_PRESET_GROUP_LABELS, HARDWARE_PRESET_GROUP_ORDER, hardwarePresets } from "./hardwarePresets";

export const DEPENDENCIES = { hardwarePresets, useServices };

type Props = {
  serviceIndex: number;
  /** While the pane is locked the preset select is disabled so the active preset stays viewable but can't be re-applied. */
  locked?: boolean;
  /** Returns whether a preset's GPU model is blocked for the current (trial) user; blocked presets render locked. */
  isBlockedModel?: (vendor?: string | null, model?: string | null) => boolean;
  /** Opens the add-credits (unlock) sheet owned by the HardwareSection. */
  onUnlock?: () => void;
  dependencies?: typeof DEPENDENCIES;
};

/**
 * Hardware "Presets" card body: a select that, on pick, overwrites the selected
 * service's compute values (CPU, memory, ephemeral storage, and optionally GPU)
 * from a {@link HardwarePreset}. A preset isn't stored in the model as a separate
 * field — its values live on `profile.*` — so the select's value is derived from
 * the current resources via {@link detectPreset}: it shows the matching preset
 * when the resources equal one and falls back to the placeholder once they're
 * edited into a custom configuration.
 *
 * Options are grouped into labelled "Compute" and "GPU" sections, each option
 * showing its name on the left and a spec summary on the right.
 */
export const PresetsCard: FC<Props> = ({ serviceIndex, locked = false, isBlockedModel = () => false, onUnlock, dependencies: d = DEPENDENCIES }) => {
  const { control, setValue } = useFormContext<SdlBuilderFormValuesType>();
  const { analyticsService } = d.useServices();
  const profile = useWatch({ control, name: `services.${serviceIndex}.profile` });
  const selectedPresetId = useMemo(() => detectPreset(d.hardwarePresets, profile ?? {})?.id ?? "", [d.hardwarePresets, profile]);

  const applySelectedPreset = useCallback(
    (id: string) => {
      const preset = d.hardwarePresets.find(candidate => candidate.id === id);
      if (!preset) {
        return;
      }
      applyPreset(setValue, serviceIndex, preset);
      analyticsService.track("configure_preset_selected", { category: "deployments", preset: id });
    },
    [d.hardwarePresets, setValue, serviceIndex, analyticsService]
  );

  const groups = HARDWARE_PRESET_GROUP_ORDER.map(group => ({
    group,
    presets: d.hardwarePresets.filter(preset => preset.group === group)
  })).filter(({ presets }) => presets.length > 0);

  const hasBlockedGpuPreset = d.hardwarePresets.some(preset => isBlockedModel(preset.gpuVendor, preset.gpuModel));

  return (
    <div className="flex flex-col gap-2">
      <Select value={selectedPresetId} onValueChange={applySelectedPreset} disabled={locked}>
        <SelectTrigger aria-label="Preset" className={`h-9 ${SELECT_TRUNCATE_VALUE}`}>
          <SelectValue placeholder="Choose a starting point..." />
        </SelectTrigger>
        <SelectContent className="min-w-[18rem]">
          {groups.map(({ group, presets }, index) => (
            <Fragment key={group}>
              {index > 0 && <SelectSeparator />}
              <PresetGroup group={group} presets={presets} isBlockedModel={isBlockedModel} />
            </Fragment>
          ))}
        </SelectContent>
      </Select>
      {hasBlockedGpuPreset && <UnlockGpusButton onUnlock={onUnlock} />}
    </div>
  );
};

const PresetGroup: FC<{
  group: HardwarePresetGroup;
  presets: HardwarePreset[];
  isBlockedModel: (vendor?: string | null, model?: string | null) => boolean;
}> = ({ group, presets, isBlockedModel }) => (
  <SelectGroup>
    <SelectLabel className="px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{HARDWARE_PRESET_GROUP_LABELS[group]}</SelectLabel>
    {presets.map(preset => {
      const blocked = isBlockedModel(preset.gpuVendor, preset.gpuModel);
      return (
        <SelectItem key={preset.id} value={preset.id} disabled={blocked} className="[&>span:last-child]:flex [&>span:last-child]:w-full">
          <span className="flex w-full items-center justify-between gap-6">
            <span className="flex items-center gap-1.5">
              {preset.label}
              {blocked && <LockIcon className="h-3 w-3 shrink-0 text-muted-foreground" aria-label="Requires credits" />}
            </span>
            <span className="font-mono text-xs text-muted-foreground">{formatPresetSpecs(preset)}</span>
          </span>
        </SelectItem>
      );
    })}
  </SelectGroup>
);
