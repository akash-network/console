import { useEffect } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useWatch } from "react-hook-form";

import type { SdlBuilderFormValuesType } from "@src/types";
import { isVmImage } from "@src/utils/sdl/vmImages";

/** `hasSSHKey` is deployment-wide, so it stays on while any service runs a VM image, whichever service's cards are on screen. */
export function useForceSshForVmServices(form: UseFormReturn<SdlBuilderFormValuesType>) {
  const services = useWatch({ control: form.control, name: "services" });
  const hasSSHKey = useWatch({ control: form.control, name: "hasSSHKey" });
  const hasVmService = (services ?? []).some(service => isVmImage(service?.image ?? ""));

  useEffect(
    function forceSshWhileVmServiceExists() {
      if (hasVmService && !hasSSHKey) {
        form.setValue("hasSSHKey", true, { shouldDirty: true });
      }
    },
    [form, hasSSHKey, hasVmService]
  );
}
