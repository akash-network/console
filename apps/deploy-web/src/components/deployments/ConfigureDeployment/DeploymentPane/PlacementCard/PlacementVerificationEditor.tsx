"use client";
import type { MouseEvent } from "react";
import { useCallback, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import {
  Button,
  DialogV2,
  DialogV2Body,
  DialogV2Content,
  DialogV2Description,
  DialogV2Footer,
  DialogV2Header,
  DialogV2Title
} from "@akashnetwork/ui/components";
import { SaveIcon, ShieldCheck } from "lucide-react";

import { PlacementVerificationFormControl } from "@src/components/sdl/PlacementVerificationFormControl";
import type { PlacementVerificationType, SdlBuilderFormValuesType } from "@src/types";

type Props = {
  placementIndex: number;
  placementName: string;
  locked: boolean;
};

export const PlacementVerificationEditor: React.FC<Props> = ({ placementIndex, placementName, locked }) => {
  const { control, formState, getValues, reset, trigger } = useFormContext<SdlBuilderFormValuesType>();
  const verification = useWatch({ control, name: `placements.${placementIndex}.verification` });
  const [isOpen, setIsOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<SdlBuilderFormValuesType | null>(null);
  const hasErrors = formState.isSubmitted && !!formState.errors.placements?.[placementIndex]?.verification;
  const summary = getPlacementVerificationSummary(verification);

  const openEditor = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      setSnapshot(structuredClone(getValues()));
      setIsOpen(true);
    },
    [getValues]
  );

  const revalidate = useCallback(() => {
    if (formState.isSubmitted) void trigger(`placements.${placementIndex}.verification`);
  }, [formState.isSubmitted, placementIndex, trigger]);

  const cancel = useCallback(() => {
    if (snapshot) reset(snapshot, { keepErrors: true, keepIsSubmitted: true });
    revalidate();
    setIsOpen(false);
  }, [reset, revalidate, snapshot]);

  const save = useCallback(() => {
    const values = structuredClone(getValues());
    const requirement = values.placements[placementIndex].verification;

    if (requirement?.auditors) {
      requirement.auditors = requirement.auditors.filter(auditor => auditor.value.trim());
      if (requirement.auditors.length === 0) requirement.auditorMode = undefined;
    }

    reset(values, { keepDirty: true, keepErrors: true, keepIsSubmitted: true });
    revalidate();
    setIsOpen(false);
  }, [getValues, placementIndex, reset, revalidate]);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        onClick={openEditor}
        aria-label={`Edit provider verification: ${summary}`}
        aria-invalid={hasErrors}
        className={`mt-2 flex h-auto w-full items-center justify-start gap-2 px-2 py-2 text-left ${hasErrors ? "border border-destructive" : ""}`}
      >
        <ShieldCheck className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-medium">Provider verification</span>
          <span className="block truncate text-xs font-normal text-muted-foreground">{summary}</span>
        </span>
      </Button>

      <DialogV2
        open={isOpen}
        onOpenChange={open => {
          if (!open) cancel();
        }}
      >
        <DialogV2Content
          className="max-w-2xl"
          aria-describedby={`placement-${placementIndex}-verification-description`}
          onClick={event => event.stopPropagation()}
        >
          <DialogV2Header>
            <DialogV2Title>Provider verification · {placementName}</DialogV2Title>
            <DialogV2Description id={`placement-${placementIndex}-verification-description`} className="sr-only">
              Provider verification requirements for {placementName}
            </DialogV2Description>
          </DialogV2Header>
          <DialogV2Body>
            <fieldset disabled={locked} className="contents">
              <PlacementVerificationFormControl control={control} placementIndex={placementIndex} showTopDivider={false} />
            </fieldset>
          </DialogV2Body>
          <DialogV2Footer>
            <Button type="button" variant="ghost" onClick={cancel}>
              Cancel
            </Button>
            <Button type="button" onClick={save} disabled={locked}>
              Save
              <SaveIcon className="ml-2 size-4" />
            </Button>
          </DialogV2Footer>
        </DialogV2Content>
      </DialogV2>
    </>
  );
};

export function getPlacementVerificationSummary(verification: PlacementVerificationType | undefined): string {
  if (!verification) return "Not required";

  const parts = [`L${verification.minTier} minimum`];

  if (verification.minAuditorCount) {
    parts.push(`${verification.minAuditorCount} ${verification.minAuditorCount === 1 ? "auditor" : "auditors"}`);
  }

  if (verification.capabilities?.length) {
    parts.push(`${verification.capabilities.length} ${verification.capabilities.length === 1 ? "capability" : "capabilities"}`);
  }

  if (verification.auditors?.length) {
    parts.push(`${verification.auditors.length} named ${verification.auditors.length === 1 ? "auditor" : "auditors"}`);
  }

  return parts.join(" · ");
}
