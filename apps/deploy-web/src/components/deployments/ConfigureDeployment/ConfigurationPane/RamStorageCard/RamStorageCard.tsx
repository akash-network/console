import type { FC } from "react";
import { useCallback } from "react";
import { useController, useFieldArray, useFormContext } from "react-hook-form";
import { CollapsibleCard, Field, FieldContent, FieldLabel, Input, NumberUnitInput } from "@akashnetwork/ui/components";
import { MicrochipIcon } from "lucide-react";

import type { SdlBuilderFormValuesType } from "@src/types";
import { storageUnits } from "@src/utils/akash/units";
import { defaultRamStorage } from "@src/utils/sdl/data";
import { ramStorageTooltip } from "../cardTooltips";

export const DEPENDENCIES = { CollapsibleCard, NumberUnitInput };

type Props = {
  serviceIndex: number;
  locked?: boolean;
  dependencies?: typeof DEPENDENCIES;
};

/**
 * Hardware "RAM Storage" card. A header switch toggles the presence of a single
 * RAM volume (`type === "ram"`) inside the shared `profile.storage` array, where
 * `storage[0]` is the ephemeral root and the remaining entries are persistent or
 * RAM volumes. Unlike persistent storage there is at most one RAM entry, its type
 * is fixed, and it carries no read-only flag — so the body just edits the volume's
 * size, name and mount.
 *
 * The body renders whenever the card is open: when a RAM volume exists it edits that
 * volume; when off it shows a short off-state hint. An open, switched-off card is only
 * reachable while the pane is locked (the chevron expands it but the switch can't flip
 * the volume in or out), so the hint just tells the viewer no volume is configured; the
 * switch alone adds or removes the volume.
 */
export const RamStorageCard: FC<Props> = ({ serviceIndex, locked = false, dependencies: d = DEPENDENCIES }) => {
  const { control } = useFormContext<SdlBuilderFormValuesType>();
  const { fields, append, remove } = useFieldArray({ control, name: `services.${serviceIndex}.profile.storage`, keyName: "key" });

  const ramIndex = fields.findIndex((field, index) => index > 0 && field.type === "ram");
  const isEnabled = ramIndex !== -1;

  const toggleRamStorage = useCallback(
    (checked: boolean) => {
      if (checked && !isEnabled) {
        append({ ...defaultRamStorage }, { shouldFocus: false });
      } else if (!checked && isEnabled) {
        remove(ramIndex);
      }
    },
    [append, remove, ramIndex, isEnabled]
  );

  return (
    <d.CollapsibleCard
      locked={locked}
      title="RAM Storage"
      icon={<MicrochipIcon className="h-4 w-4" />}
      infoTooltip={ramStorageTooltip}
      isToggled={isEnabled}
      onToggle={toggleRamStorage}
      toggleAriaLabel="Enable RAM storage"
      toggleDisabled={locked}
    >
      {isEnabled ? (
        <RamStorageFields serviceIndex={serviceIndex} storageIndex={ramIndex} dependencies={d} disabled={locked} />
      ) : (
        <p className="text-sm text-muted-foreground">RAM storage is off.</p>
      )}
    </d.CollapsibleCard>
  );
};

type RamStorageFieldsProps = {
  serviceIndex: number;
  storageIndex: number;
  dependencies: typeof DEPENDENCIES;
  /** Greys out every input — set while the pane is locked so configured values stay viewable but read-only. */
  disabled?: boolean;
};

const RamStorageFields: FC<RamStorageFieldsProps> = ({ serviceIndex, storageIndex, dependencies: d, disabled = false }) => {
  const { control } = useFormContext<SdlBuilderFormValuesType>();
  const basePath = `services.${serviceIndex}.profile.storage.${storageIndex}` as const;

  const size = useController({ control, name: `${basePath}.size` });
  const unit = useController({ control, name: `${basePath}.unit` });
  const name = useController({ control, name: `${basePath}.name` });
  const mount = useController({ control, name: `${basePath}.mount` });

  return (
    <>
      <Field className="gap-2">
        <FieldLabel>Storage</FieldLabel>
        <FieldContent>
          <d.NumberUnitInput
            label="RAM storage"
            units={storageUnits}
            value={size.field.value ?? undefined}
            unit={unit.field.value}
            onValueChange={value => size.field.onChange(value ?? null)}
            onUnitChange={unit.field.onChange}
            error={size.fieldState.error?.message ?? unit.fieldState.error?.message}
            disabled={disabled}
          />
        </FieldContent>
      </Field>

      <Field className="gap-2">
        <FieldLabel htmlFor={`ram-storage-${serviceIndex}-name`}>Name</FieldLabel>
        <FieldContent>
          <Input
            id={`ram-storage-${serviceIndex}-name`}
            aria-label="RAM storage name"
            value={name.field.value ?? ""}
            onChange={name.field.onChange}
            disabled={disabled}
            inputClassName="h-9"
          />
          {name.fieldState.error && <p className="pl-1 text-xs text-destructive">{name.fieldState.error.message}</p>}
        </FieldContent>
      </Field>

      <Field className="gap-2">
        <FieldLabel htmlFor={`ram-storage-${serviceIndex}-mount`}>Mount</FieldLabel>
        <FieldContent>
          <Input
            id={`ram-storage-${serviceIndex}-mount`}
            aria-label="RAM storage mount"
            value={mount.field.value ?? ""}
            onChange={mount.field.onChange}
            disabled={disabled}
            inputClassName="h-9"
          />
          {mount.fieldState.error && <p className="pl-1 text-xs text-destructive">{mount.fieldState.error.message}</p>}
        </FieldContent>
      </Field>
    </>
  );
};
