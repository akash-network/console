import type { FC } from "react";
import { useCallback } from "react";
import { useController, useFormContext, useWatch } from "react-hook-form";
import { Checkbox, Label } from "@akashnetwork/ui/components";

import type { SdlBuilderFormValuesType } from "@src/types";
import { isVmImage } from "@src/utils/sdl/vmImages";
import { SshPublicKeyField, useApplySshKeyToAllServices } from "../SshPublicKeyField/SshPublicKeyField";

export const DEPENDENCIES = { SshPublicKeyField };

type Props = {
  serviceIndex: number;
  dependencies?: typeof DEPENDENCIES;
};

/** Forced on while any service is a VM, since unchecking the deployment-wide flag would strip the VM's key too. */
export const ExposeSshField: FC<Props> = ({ serviceIndex, dependencies: d = DEPENDENCIES }) => {
  const { control } = useFormContext<SdlBuilderFormValuesType>();
  const hasSSHKey = useController({ control, name: "hasSSHKey" });
  const services = useWatch({ control, name: "services" });
  const hasVmService = (services ?? []).some(service => isVmImage(service?.image ?? ""));
  const applyKeyToAllServices = useApplySshKeyToAllServices();

  const toggleExposeSsh = useCallback(
    (checked: boolean) => {
      hasSSHKey.field.onChange(checked);
      if (!checked) {
        applyKeyToAllServices("");
      }
    },
    [hasSSHKey.field, applyKeyToAllServices]
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Checkbox
          id={`expose-ssh-${serviceIndex}`}
          checked={hasVmService || !!hasSSHKey.field.value}
          disabled={hasVmService}
          onCheckedChange={checked => toggleExposeSsh(!!checked)}
        />
        <Label htmlFor={`expose-ssh-${serviceIndex}`}>Expose SSH</Label>
      </div>

      {(hasVmService || hasSSHKey.field.value) && <d.SshPublicKeyField serviceIndex={serviceIndex} />}
    </div>
  );
};
