import { useEffect, useRef } from "react";
import type { UseFormReturn } from "react-hook-form";

import { useConfigureFormRegistry } from "@src/components/assistant/configureFormRegistry/configureFormRegistry";
import { useCachedPlacementScreening } from "@src/queries/useScreenedProviders";
import type { SdlBuilderFormValuesType } from "@src/types";
import type { DeploymentFlowPhase } from "../useDeploymentFlow/useDeploymentFlow";
import { applyConfigureFormEdit, ConfigureFormEditError } from "./applyConfigureFormEdit";
import { isEditablePhase, readConfigureForm } from "./readConfigureForm";

export const DEPENDENCIES = { useConfigureFormRegistry, useCachedPlacementScreening };

const EDITED_FIELD_OPTIONS = { shouldDirty: true, shouldValidate: true } as const;

const NOT_EDITABLE_MESSAGE = "The deployment is past configuring, so its settings can't change here. Edit the deployment first, then apply this again.";

type Input = {
  form: UseFormReturn<SdlBuilderFormValuesType>;
  phase: DeploymentFlowPhase;
  sdl: string;
};

/** Lets the assistant read the form and apply an edit while the configure page is open, through the registry the panel reaches. */
export function usePublishConfigureForm({ form, phase, sdl }: Input, d: typeof DEPENDENCIES = DEPENDENCIES) {
  const registry = d.useConfigureFormRegistry();
  const readPlacementScreening = d.useCachedPlacementScreening();
  const latest = useRef({ phase, sdl });
  latest.current = { phase, sdl };

  useEffect(
    function publishWhileMounted() {
      return registry.publish({
        read: () => {
          const values = form.getValues();
          return readConfigureForm(values, { phase: latest.current.phase, providers: readPlacementScreening(latest.current.sdl, values.placements) });
        },
        applyEdit: edit => {
          if (!isEditablePhase(latest.current.phase)) throw new ConfigureFormEditError(NOT_EDITABLE_MESSAGE);

          const edited = applyConfigureFormEdit(form.getValues(), edit);
          form.setValue("services", edited.services, EDITED_FIELD_OPTIONS);
          form.setValue("placements", edited.placements, EDITED_FIELD_OPTIONS);
          refreshEditableFieldArrays(form, edited.services);
        }
      });
    },
    [registry, form, readPlacementScreening]
  );
}

/** A parent path setValue never notifies a nested useFieldArray, so the storage and GPU cards would keep showing their pre-edit rows. */
function refreshEditableFieldArrays(form: UseFormReturn<SdlBuilderFormValuesType>, services: SdlBuilderFormValuesType["services"]) {
  services.forEach((service, index) => {
    form.setValue(`services.${index}.profile.storage`, service.profile.storage, EDITED_FIELD_OPTIONS);
    form.setValue(`services.${index}.profile.gpuModels`, service.profile.gpuModels, EDITED_FIELD_OPTIONS);
  });
}
