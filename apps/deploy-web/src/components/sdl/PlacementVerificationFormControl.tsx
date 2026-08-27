"use client";
import { forwardRef, useCallback, useImperativeHandle } from "react";
import type { Control } from "react-hook-form";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import {
  Button,
  CheckboxWithLabel,
  CustomTooltip,
  FormField,
  FormInput,
  FormItem,
  FormLabel,
  FormMessage,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch
} from "@akashnetwork/ui/components";
import { Bin, InfoCircle, Plus } from "iconoir-react";
import { nanoid } from "nanoid";

import type { PlacementVerificationType, SdlBuilderFormValuesType } from "@src/types";

type Props = {
  placementIndex: number;
  control: Control<SdlBuilderFormValuesType>;
  showTopDivider?: boolean;
};

export type PlacementVerificationRefType = {
  removeAuditors: (index: number | number[]) => void;
};

type Capability = NonNullable<PlacementVerificationType["capabilities"]>[number];

const defaultVerification = (): PlacementVerificationType => ({
  minTier: 1,
  capabilities: [],
  auditors: []
});

const TIER_OPTIONS = [
  { value: 1, label: "L1 - Identified", description: "Operator identity verified" },
  { value: 2, label: "L2 - Verified", description: "Resources and location checked" },
  { value: 3, label: "L3 - Established", description: "Sustained reliability checked" },
  { value: 4, label: "L4 - Trusted", description: "Physical audit and SLA" }
] as const;

const CAPABILITY_OPTIONS = [
  { value: "tee_hardware_attestation", label: "TEE hardware attestation" },
  { value: "confidential_computing", label: "Confidential computing" },
  { value: "persistent_storage", label: "Persistent storage" },
  { value: "bare_metal", label: "Bare metal" }
] satisfies ReadonlyArray<{ value: Capability; label: string }>;

export const PlacementVerificationFormControl = forwardRef<PlacementVerificationRefType, Props>(({ control, placementIndex, showTopDivider = true }, ref) => {
  const { setValue } = useFormContext<SdlBuilderFormValuesType>();
  const verification = useWatch({ control, name: `placements.${placementIndex}.verification` });
  const {
    fields: auditors,
    append: appendAuditor,
    remove: removeAuditor
  } = useFieldArray({
    control,
    name: `placements.${placementIndex}.verification.auditors`,
    keyName: "fieldId"
  });
  const selectedTier = TIER_OPTIONS.find(option => option.value === verification?.minTier) ?? TIER_OPTIONS[0];

  const removeAuditors = useCallback(
    (index: number | number[]) => {
      const indexes = new Set(Array.isArray(index) ? index : [index]);
      const removesEveryAuditor = auditors.length > 0 && auditors.every((_, auditorIndex) => indexes.has(auditorIndex));

      removeAuditor(index);
      if (removesEveryAuditor) {
        setValue(`placements.${placementIndex}.verification.auditorMode`, undefined, { shouldDirty: true });
      }
    },
    [auditors, placementIndex, removeAuditor, setValue]
  );

  useImperativeHandle(ref, () => ({ removeAuditors }), [removeAuditors]);

  return (
    <section aria-labelledby={`placement-${placementIndex}-verification-title`} className={showTopDivider ? "mt-6 border-t pt-4" : undefined}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center">
            <strong id={`placement-${placementIndex}-verification-title`} className="text-sm">
              Require verified providers
            </strong>
            <CustomTooltip title="Require auditor-attested provider verification for this placement.">
              <InfoCircle className="ml-2 text-sm text-muted-foreground" />
            </CustomTooltip>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{verification ? "Only providers meeting every requirement may bid" : "Any provider may bid"}</p>
        </div>

        <FormField
          control={control}
          name={`placements.${placementIndex}.verification`}
          render={({ field }) => (
            <Switch
              aria-label="Require provider verification"
              checked={field.value !== undefined}
              onCheckedChange={checked => field.onChange(checked ? defaultVerification() : undefined)}
            />
          )}
        />
      </div>

      {verification ? (
        <div className="mt-4 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={control}
              name={`placements.${placementIndex}.verification.minTier`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor={`placement-${placementIndex}-verification-tier`}>Minimum tier</FormLabel>
                  <Select value={String(field.value)} onValueChange={value => field.onChange(Number(value))}>
                    <SelectTrigger id={`placement-${placementIndex}-verification-tier`} className="mt-1" aria-label="Minimum verification tier">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIER_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={String(option.value)}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{selectedTier.description}</p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name={`placements.${placementIndex}.verification.minAuditorCount`}
              render={({ field }) => (
                <FormInput
                  type="number"
                  label="Minimum auditors"
                  value={field.value ?? ""}
                  min={0}
                  max={4_294_967_295}
                  step={1}
                  onChange={event => field.onChange(event.target.value === "" ? undefined : event.target.valueAsNumber)}
                />
              )}
            />
          </div>

          <FormField
            control={control}
            name={`placements.${placementIndex}.verification.capabilities`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Required capabilities</FormLabel>
                <div className="grid gap-3 pt-1 sm:grid-cols-2">
                  {CAPABILITY_OPTIONS.map(option => (
                    <CheckboxWithLabel
                      key={option.value}
                      label={option.label}
                      checked={field.value?.includes(option.value) ?? false}
                      onCheckedChange={checked => {
                        const current = field.value ?? [];
                        field.onChange(checked === true ? [...current, option.value] : current.filter(value => value !== option.value));
                      }}
                    />
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="border-t pt-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <FormLabel>Named auditors</FormLabel>
                <p className="mt-1 text-xs text-muted-foreground">Optional auditor address requirements</p>
              </div>
              <Button type="button" variant="default" size="sm" onClick={() => appendAuditor({ id: nanoid(), value: "" })}>
                <Plus className="mr-1 h-4 w-4" />
                Add auditor
              </Button>
            </div>

            {auditors.length > 0 ? (
              <div className="mt-4 space-y-3">
                {auditors.map((auditor, auditorIndex) => (
                  <div key={auditor.fieldId} className="flex items-end gap-2">
                    <div className="flex-1">
                      <FormField
                        control={control}
                        name={`placements.${placementIndex}.verification.auditors.${auditorIndex}.value`}
                        render={({ field }) => (
                          <FormInput
                            type="text"
                            label={`Auditor ${auditorIndex + 1}`}
                            placeholder="akash1..."
                            className="w-full"
                            value={field.value}
                            onChange={event => field.onChange(event.target.value)}
                          />
                        )}
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={() => removeAuditors(auditorIndex)}
                      size="icon"
                      variant="ghost"
                      aria-label={`Remove auditor ${auditorIndex + 1}`}
                    >
                      <Bin />
                    </Button>
                  </div>
                ))}

                <FormField
                  control={control}
                  name={`placements.${placementIndex}.verification.auditorMode`}
                  render={({ field }) => (
                    <FormItem className="max-w-sm">
                      <FormLabel htmlFor={`placement-${placementIndex}-auditor-mode`}>Named auditor policy</FormLabel>
                      <Select value={field.value ?? "any"} onValueChange={value => field.onChange(value === "all" ? "all" : "any")}>
                        <SelectTrigger id={`placement-${placementIndex}-auditor-mode`} className="mt-1" aria-label="Named auditor policy">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Any listed auditor</SelectItem>
                          <SelectItem value="all">All listed auditors</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">None</p>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-5">
          <p className="mb-2 font-mono text-xs uppercase text-muted-foreground">Verification tiers</p>
          <div className="overflow-hidden rounded-md border">
            {TIER_OPTIONS.map(option => (
              <div key={option.value} className="grid grid-cols-[7.5rem_1fr] items-center gap-3 border-b px-3 py-2.5 last:border-b-0">
                <span className="text-sm font-medium">{option.label}</span>
                <span className="text-xs text-muted-foreground">{option.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
});

PlacementVerificationFormControl.displayName = "PlacementVerificationFormControl";
