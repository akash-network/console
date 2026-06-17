import { useEffect } from "react";
import { useFormContext, useFormState, useWatch } from "react-hook-form";

import type { SdlBuilderFormValuesType } from "@src/types";

type ServiceStorage = SdlBuilderFormValuesType["services"][number]["profile"]["storage"][number];

/**
 * RHF paths to field arrays whose rows are validated for a unique key
 * (name/title). Top-level arrays plus the per-service storage array, whose
 * persistent and RAM volumes must each carry a unique name and mount.
 */
type UniqueFieldArrayName = "placements" | "services" | "endpoints" | `services.${number}.profile.storage`;

/** Resolves the row item type for a given field-array path so `selectKey` stays typed. */
type UniqueFieldArrayItem<TName extends UniqueFieldArrayName> = TName extends "placements"
  ? SdlBuilderFormValuesType["placements"][number]
  : TName extends "services"
    ? SdlBuilderFormValuesType["services"][number]
    : TName extends "endpoints"
      ? NonNullable<SdlBuilderFormValuesType["endpoints"]>[number]
      : ServiceStorage;

/**
 * Re-runs validation for the `name` field array whenever the `selectKey` value
 * of any row changes. React Hook Form only refreshes the error slot of the field
 * that changed, so a cross-row "must be unique" error stays stale on sibling rows
 * even after the conflict is resolved or removed elsewhere. Re-validating the
 * whole array recomputes every row's error and clears the stale ones.
 *
 * `trigger` is called with an array path rather than a bare string on purpose:
 * each row's input subscribes to its exact field path (`endpoints.0.name`, …),
 * and an array argument makes RHF broadcast the validation update to every field
 * subscriber so sibling rows re-render. A bare string only notifies the array
 * path itself, leaving the rows visually stale.
 *
 * Gated on `isSubmitted`: `trigger` force-validates regardless of submit state, so
 * running it before the form is submitted would surface errors on pristine fields
 * (e.g. an empty default image on a freshly added service) and defeat the form's
 * validate-on-submit mode. Before the first submit there is nothing on screen to
 * keep fresh; once submitted, this keeps sibling uniqueness errors consistent as
 * rows are renamed, added or removed.
 *
 * `useWatch` widens its return to the union of every possible field value when
 * `name` is a generic path, so its result is narrowed back to this path's row
 * type — the one place RHF's types can't track a generic path to its element.
 */
export const useRevalidateUniqueness = <TName extends UniqueFieldArrayName>(name: TName, selectKey: (item: UniqueFieldArrayItem<TName>) => string) => {
  const { control, trigger } = useFormContext<SdlBuilderFormValuesType>();
  const { isSubmitted } = useFormState({ control });
  const items = useWatch({ control, name }) as UniqueFieldArrayItem<TName>[] | undefined;
  const key = (items ?? []).map(selectKey).join("\u0000");

  useEffect(
    function revalidateUniquenessOnKeyChange() {
      if (!isSubmitted) {
        return;
      }
      void trigger([name]);
    },
    [key, name, isSubmitted, trigger]
  );
};
