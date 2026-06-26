import type { FC } from "react";
import { useCallback } from "react";
import { useController, useFieldArray, useFormContext } from "react-hook-form";
import {
  Button,
  Checkbox,
  CollapsibleCard,
  Field,
  FieldContent,
  FieldError,
  FieldLabel,
  Input,
  Label,
  NumberUnitInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@akashnetwork/ui/components";
import { HardDriveIcon, PlusIcon, TrashIcon } from "lucide-react";

import type { SdlBuilderFormValuesType } from "@src/types";
import { persistentStorageTypes, storageUnits } from "@src/utils/akash/units";
import { defaultPersistentStorage } from "@src/utils/sdl/data";
import { persistentStorageTooltip } from "../cardTooltips";
import { SELECT_TRUNCATE_VALUE } from "../selectStyles";

export const DEPENDENCIES = { CollapsibleCard, NumberUnitInput };

type Props = {
  serviceIndex: number;
  locked?: boolean;
  dependencies?: typeof DEPENDENCIES;
};

/**
 * Hardware "Persistent Storage" card. A header switch toggles the presence of
 * persistent storage entries (`profile.storage[1..n]`, with `storage[0]` reserved
 * for ephemeral root storage). Enabling appends one persistent-storage default;
 * disabling drops every persistent entry. While enabled the body renders one
 * editable block per persistent entry — type, size, name, mount and a read-only
 * flag — plus an "Add more" button. Every block has its own remove control while
 * more than one exists; the last remaining block hides it (removing the only
 * persistent volume is done by toggling the switch off).
 *
 * When open with no persistent entry the body shows a short off-state hint instead.
 * An open, switched-off card is only reachable while the pane is locked (the chevron
 * expands it but the switch can't add the volume), so the hint just tells the viewer no
 * volume is configured; the switch alone adds the first volume.
 */
export const PersistentStorageCard: FC<Props> = ({ serviceIndex, locked = false, dependencies: d = DEPENDENCIES }) => {
  const { control, getValues } = useFormContext<SdlBuilderFormValuesType>();
  const { fields, append, remove } = useFieldArray({ control, name: `services.${serviceIndex}.profile.storage`, keyName: "key" });

  const persistentFields = fields.map((field, index) => ({ field, index })).filter(({ field, index }) => index > 0 && field.type !== "ram");
  const isEnabled = persistentFields.length > 0;

  const appendPersistentStorage = useCallback(() => {
    const storage = getValues(`services.${serviceIndex}.profile.storage`) ?? [];
    const takenNames = new Set(storage.map(volume => volume.name).filter((value): value is string => !!value));
    const takenMounts = new Set(storage.map(volume => volume.mount).filter((value): value is string => !!value));
    append(
      {
        ...defaultPersistentStorage,
        name: nextAvailableValue(defaultPersistentStorage.name, takenNames),
        mount: nextAvailableValue(defaultPersistentStorage.mount, takenMounts)
      },
      { shouldFocus: false }
    );
  }, [append, getValues, serviceIndex]);

  const togglePersistentStorage = useCallback(
    (checked: boolean) => {
      if (checked && !isEnabled) {
        appendPersistentStorage();
      } else if (!checked && isEnabled) {
        remove(persistentFields.map(({ index }) => index));
      }
    },
    [appendPersistentStorage, remove, persistentFields, isEnabled]
  );

  return (
    <d.CollapsibleCard
      title="Persistent Storage"
      icon={<HardDriveIcon className="h-4 w-4" />}
      infoTooltip={persistentStorageTooltip}
      isToggled={isEnabled}
      onToggle={togglePersistentStorage}
      toggleAriaLabel="Enable persistent storage"
      toggleDisabled={locked}
    >
      {isEnabled ? (
        <>
          {persistentFields.map(({ field, index }, position) => (
            <PersistentStorageFields
              key={field.key}
              serviceIndex={serviceIndex}
              storageIndex={index}
              label={position + 1}
              dependencies={d}
              disabled={locked}
              onRemove={persistentFields.length > 1 ? () => remove(index) : undefined}
            />
          ))}

          <div className="flex justify-end">
            <button
              type="button"
              aria-label="Add persistent storage"
              onClick={appendPersistentStorage}
              disabled={locked}
              className="flex w-full items-center justify-center rounded-md py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
            >
              <PlusIcon className="h-4 w-4" />
            </button>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Persistent storage is off.</p>
      )}
    </d.CollapsibleCard>
  );
};

type PersistentStorageFieldsProps = {
  serviceIndex: number;
  storageIndex: number;
  label: number;
  dependencies: typeof DEPENDENCIES;
  /** Greys out every input and the remove control — set while the pane is locked so configured values stay viewable but read-only. */
  disabled?: boolean;
  onRemove?: () => void;
};

const PersistentStorageFields: FC<PersistentStorageFieldsProps> = ({ serviceIndex, storageIndex, label, dependencies: d, disabled = false, onRemove }) => {
  const { control } = useFormContext<SdlBuilderFormValuesType>();
  const basePath = `services.${serviceIndex}.profile.storage.${storageIndex}` as const;

  const type = useController({ control, name: `${basePath}.type` });
  const size = useController({ control, name: `${basePath}.size` });
  const unit = useController({ control, name: `${basePath}.unit` });
  const name = useController({ control, name: `${basePath}.name` });
  const mount = useController({ control, name: `${basePath}.mount` });
  const isReadOnly = useController({ control, name: `${basePath}.isReadOnly` });

  return (
    <div role="group" aria-label={`Persistent Storage ${label}`} className="flex flex-col gap-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase text-muted-foreground">Persistent Storage {label}</span>
        {onRemove && (
          <Button
            size="icon"
            type="button"
            variant="ghost"
            className="h-6 w-6"
            aria-label={`Remove Persistent Storage ${label}`}
            onClick={onRemove}
            disabled={disabled}
          >
            <TrashIcon className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Field className="gap-2">
        <FieldLabel>Type</FieldLabel>
        <FieldContent>
          <Select value={type.field.value ?? ""} onValueChange={type.field.onChange} disabled={disabled}>
            <SelectTrigger aria-label="Storage type" className={`h-9 ${SELECT_TRUNCATE_VALUE}`}>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {persistentStorageTypes.map(option => (
                <SelectItem key={option.className} value={option.className}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError>{type.fieldState.error?.message}</FieldError>
        </FieldContent>
      </Field>

      <Field className="gap-2">
        <FieldLabel>Storage</FieldLabel>
        <FieldContent>
          <d.NumberUnitInput
            label="Persistent storage"
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
        <FieldLabel htmlFor={`storage-${serviceIndex}-${storageIndex}-name`}>Name</FieldLabel>
        <FieldContent>
          <Input
            id={`storage-${serviceIndex}-${storageIndex}-name`}
            aria-label="Storage name"
            value={name.field.value ?? ""}
            onChange={name.field.onChange}
            disabled={disabled}
            inputClassName="h-9"
          />
          {name.fieldState.error && <p className="pl-1 text-xs text-destructive">{name.fieldState.error.message}</p>}
        </FieldContent>
      </Field>

      <Field className="gap-2">
        <FieldLabel htmlFor={`storage-${serviceIndex}-${storageIndex}-mount`}>Mount</FieldLabel>
        <FieldContent>
          <Input
            id={`storage-${serviceIndex}-${storageIndex}-mount`}
            aria-label="Storage mount"
            value={mount.field.value ?? ""}
            onChange={mount.field.onChange}
            disabled={disabled}
            inputClassName="h-9"
          />
          {mount.fieldState.error && <p className="pl-1 text-xs text-destructive">{mount.fieldState.error.message}</p>}
        </FieldContent>
      </Field>

      <div className="flex items-center gap-2">
        <Checkbox
          id={`storage-${serviceIndex}-${storageIndex}-readonly`}
          checked={!!isReadOnly.field.value}
          onCheckedChange={isReadOnly.field.onChange}
          disabled={disabled}
        />
        <Label htmlFor={`storage-${serviceIndex}-${storageIndex}-readonly`}>Read only</Label>
      </div>
    </div>
  );
};

/**
 * Returns the first non-colliding value built from `base`: `base`, then `base-1`,
 * `base-2`, and so on. Used to default new persistent-storage name and mount
 * fields so a fresh entry never duplicates an existing one (which the schema
 * rejects). Works for both `data`/`data-1` and `/mnt/data`/`/mnt/data-1`.
 */
function nextAvailableValue(base: string, taken: Set<string>): string {
  if (!taken.has(base)) {
    return base;
  }

  let suffix = 1;
  while (taken.has(`${base}-${suffix}`)) {
    suffix++;
  }
  return `${base}-${suffix}`;
}
