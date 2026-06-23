import { useEffect } from "react";
import { useFormContext, useFormState, useWatch } from "react-hook-form";

import type { SdlBuilderFormValuesType } from "@src/types";

/** Field arrays whose rows are validated for a unique key (name/title). */
type UniqueFieldArrayName = "placements" | "services" | "endpoints";

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
 */
export const useRevalidateUniqueness = <TName extends UniqueFieldArrayName>(
  name: TName,
  selectKey: (item: SdlBuilderFormValuesType[TName][number]) => string
) => {
  const { control, trigger } = useFormContext<SdlBuilderFormValuesType>();
  const { isSubmitted } = useFormState({ control });
  const items = useWatch({ control, name }) as SdlBuilderFormValuesType[TName] | undefined;
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
