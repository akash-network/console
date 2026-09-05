import type { FC } from "react";
import { useRef, useState } from "react";
import { useController, useFormContext } from "react-hook-form";
import {
  Field,
  FieldContent,
  FieldLabel,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  NumberUnitInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useFieldError
} from "@akashnetwork/ui/components";

import { useServices } from "@src/context/ServicesProvider";
import { useFlag } from "@src/hooks/useFlag";
import type { SdlBuilderFormValuesType } from "@src/types";
import { memoryUnits, storageUnits, validationConfig } from "@src/utils/akash/units";
import { SELECT_TRUNCATE_VALUE } from "../selectStyles";

export const DEPENDENCIES = { NumberUnitInput, useFieldError, useServices, useFlag };

/** Value standing in for "write no architecture at all", which a Select cannot express as an empty string. */
const DEFAULT_ARCH_OPTION = "default";

const ARCH_OPTIONS = [
  { value: DEFAULT_ARCH_OPTION, label: "Default (amd64)" },
  { value: "amd64", label: "amd64" },
  { value: "arm64", label: "arm64" }
] as const;

type Props = {
  serviceIndex: number;
  /** While the pane is locked the compute inputs are disabled so configured values stay viewable but read-only. */
  locked?: boolean;
  dependencies?: typeof DEPENDENCIES;
};

/**
 * Hardware "Compute Resources" card body: vCPU count plus side-by-side Memory and Storage
 * number+unit inputs. Writes to the selected service's compute profile
 * (`profile.cpu`, `profile.ram`/`ramUnit`, `profile.storage[0].size`/`unit`)
 * and surfaces the existing schema validation inline on each field.
 */
export const ComputeResourcesCard: FC<Props> = ({ serviceIndex, locked = false, dependencies: d = DEPENDENCIES }) => {
  const { control } = useFormContext<SdlBuilderFormValuesType>();
  const { analyticsService } = d.useServices();
  const cpuFocusValueRef = useRef<number | null>(null);
  const isCpuArchEnabled = d.useFlag("ui_sdl_cpu_arch");

  const arch = useController({ control, name: `services.${serviceIndex}.profile.arch` });
  /**
   * An architecture imported from an SDL stays visible with the flag off, so the value is never
   * silently carried into a deployment through a control the user cannot see.
   */
  const [hasCarriedArch] = useState(() => !!arch.field.value);

  const selectCpuArch = (value: string) => {
    arch.field.onChange(value === DEFAULT_ARCH_OPTION ? undefined : value);
    analyticsService.track("configure_cpu_arch_changed", { category: "deployments", arch: value });
  };

  const ram = useController({ control, name: `services.${serviceIndex}.profile.ram` });
  const ramUnit = useController({ control, name: `services.${serviceIndex}.profile.ramUnit` });
  const storageSize = useController({ control, name: `services.${serviceIndex}.profile.storage.0.size` });
  const storageUnit = useController({ control, name: `services.${serviceIndex}.profile.storage.0.unit` });

  const { error: ramError } = d.useFieldError(`services.${serviceIndex}.profile.ram`);
  const { error: storageError } = d.useFieldError(`services.${serviceIndex}.profile.storage.0.size`);

  return (
    <>
      <FormField
        control={control}
        name={`services.${serviceIndex}.profile.cpu`}
        render={({ field, fieldState }) => {
          const captureCpuCount = () => {
            cpuFocusValueRef.current = field.value;
          };
          const commitCpuCount = () => {
            if (field.value !== cpuFocusValueRef.current && Number.isFinite(field.value)) {
              analyticsService.track("configure_cpu_count_changed", { category: "deployments", count: field.value });
            }
            field.onBlur();
          };
          return (
            <FormItem>
              <FormLabel className="text-sm" htmlFor="cpu-count-input">
                CPU Count
              </FormLabel>
              <Input
                type="number"
                id="cpu-count"
                aria-label="CPU Count"
                error={!!fieldState.error}
                value={Number.isFinite(field.value) ? field.value : ""}
                min={0.1}
                step={0.1}
                max={validationConfig.maxCpuAmount}
                disabled={locked}
                onFocus={captureCpuCount}
                onChange={event => {
                  const next = parseFloat(event.target.value);
                  field.onChange(Number.isFinite(next) ? next : null);
                }}
                onBlur={commitCpuCount}
                inputClassName="h-9"
              />
              <FormMessage className="text-muted-foreground" />
            </FormItem>
          );
        }}
      />

      <div className="grid grid-cols-2 gap-2">
        <Field className="gap-2">
          <FieldLabel>Memory</FieldLabel>
          <FieldContent>
            <d.NumberUnitInput
              label="Memory"
              units={memoryUnits}
              value={ram.field.value ?? undefined}
              unit={ramUnit.field.value}
              onValueChange={value => ram.field.onChange(value ?? null)}
              onUnitChange={ramUnit.field.onChange}
              onBlur={ram.field.onBlur}
              error={ramError}
              errorClassName="text-muted-foreground"
              disabled={locked}
            />
          </FieldContent>
        </Field>
        <Field className="gap-2">
          <FieldLabel>Storage</FieldLabel>
          <FieldContent>
            <d.NumberUnitInput
              label="Storage"
              units={storageUnits}
              value={storageSize.field.value ?? undefined}
              unit={storageUnit.field.value}
              onValueChange={value => storageSize.field.onChange(value ?? null)}
              onUnitChange={storageUnit.field.onChange}
              onBlur={storageSize.field.onBlur}
              error={storageError}
              errorClassName="text-muted-foreground"
              disabled={locked}
            />
          </FieldContent>
        </Field>
      </div>

      {(isCpuArchEnabled || hasCarriedArch) && (
        <Field className="gap-2">
          <FieldLabel>CPU Architecture</FieldLabel>
          <FieldContent>
            <Select value={arch.field.value ?? DEFAULT_ARCH_OPTION} onValueChange={selectCpuArch} disabled={locked}>
              <SelectTrigger aria-label="CPU Architecture" className={`h-9 ${SELECT_TRUNCATE_VALUE}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ARCH_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldContent>
        </Field>
      )}
    </>
  );
};
