import type { FC } from "react";
import { useCallback } from "react";
import { useController, useFormContext } from "react-hook-form";
import { CollapsibleCard, Field, FieldContent, FieldError, FieldLabel, QuantityStepper } from "@akashnetwork/ui/components";
import { BoxesIcon } from "lucide-react";

import type { SdlBuilderFormValuesType } from "@src/types";
import { replicasTooltip } from "../cardTooltips";

export const DEPENDENCIES = { CollapsibleCard, QuantityStepper };

type Props = {
  serviceIndex: number;
  /** While the pane is locked the quantity stepper is disabled so the configured count stays viewable but read-only. */
  locked?: boolean;
  dependencies?: typeof DEPENDENCIES;
};

export const ReplicasCard: FC<Props> = ({ serviceIndex, locked = false, dependencies: d = DEPENDENCIES }) => {
  const { control, trigger, formState } = useFormContext<SdlBuilderFormValuesType>();
  const count = useController({ control, name: `services.${serviceIndex}.count` });
  const hasErrors = formState.isSubmitted && !!formState.errors.services?.[serviceIndex]?.count;

  /**
   * The replica count feeds the per-group CPU/RAM/GPU totals, so re-validate those limits when the user
   * changes it — from the change handler rather than a mount effect, which would surface limit errors on
   * still-untouched fields.
   */
  const changeCount = useCallback(
    (value: number) => {
      count.field.onChange(value);
      void trigger([`services.${serviceIndex}.profile.cpu`, `services.${serviceIndex}.profile.ram`, `services.${serviceIndex}.profile.gpu`]);
    },
    [count.field, trigger, serviceIndex]
  );

  return (
    <d.CollapsibleCard
      defaultOpen={false}
      locked={locked}
      title="Replicas"
      icon={<BoxesIcon className="h-4 w-4" />}
      infoTooltip={replicasTooltip}
      className={hasErrors ? "border-destructive dark:border-destructive" : undefined}
    >
      <fieldset disabled={locked} className="flex min-w-0 flex-col gap-4 border-0 p-0">
        <Field className="gap-2">
          <FieldLabel>Quantity</FieldLabel>
          <FieldContent>
            <d.QuantityStepper
              label="Quantity"
              className="self-start"
              value={count.field.value ?? 1}
              min={1}
              max={20}
              aria-describedby={count.fieldState.error ? `replicas-error-${serviceIndex}` : undefined}
              onChange={changeCount}
            />
            <FieldError id={`replicas-error-${serviceIndex}`} className="text-muted-foreground">
              {count.fieldState.error?.message}
            </FieldError>
          </FieldContent>
        </Field>
      </fieldset>
    </d.CollapsibleCard>
  );
};
