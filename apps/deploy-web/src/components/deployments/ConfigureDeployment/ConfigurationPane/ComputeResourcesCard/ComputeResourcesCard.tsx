import type { FC } from "react";
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
  useFieldError
} from "@akashnetwork/ui/components";

import type { SdlBuilderFormValuesType } from "@src/types";
import { memoryUnits, storageUnits, validationConfig } from "@src/utils/akash/units";

export const DEPENDENCIES = { NumberUnitInput, useFieldError };

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
        render={({ field, fieldState }) => (
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
              onChange={event => {
                const next = parseFloat(event.target.value);
                field.onChange(Number.isFinite(next) ? next : null);
              }}
              onBlur={field.onBlur}
              inputClassName="h-9"
            />
            <FormMessage className="text-muted-foreground" />
          </FormItem>
        )}
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
    </>
  );
};
