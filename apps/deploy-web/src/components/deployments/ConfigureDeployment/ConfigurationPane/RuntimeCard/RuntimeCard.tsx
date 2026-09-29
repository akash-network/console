import type { FC } from "react";
import { useCallback } from "react";
import { useController, useFormContext, useWatch } from "react-hook-form";
import { Checkbox, CollapsibleCard, Field, FieldContent, FieldError, FieldLabel, Label, QuantityStepper } from "@akashnetwork/ui/components";
import { SettingsIcon } from "lucide-react";

import type { SdlBuilderFormValuesType } from "@src/types";
import { isVmImage } from "@src/utils/sdl/vmImages";
import { runtimeTooltip } from "../cardTooltips";
import { SshPublicKeyField, useApplySshKeyToAllServices } from "../SshPublicKeyField/SshPublicKeyField";

export const DEPENDENCIES = { CollapsibleCard, QuantityStepper, SshPublicKeyField };

type Props = {
  serviceIndex: number;
  /** While the pane is locked every input in the card body is disabled so configured values stay viewable but read-only. */
  locked?: boolean;
  dependencies?: typeof DEPENDENCIES;
};

/**
 * "Runtime" card. Edits the non-image runtime fields of a service on the shared deployment model: the replica count
 * (`count`) and, behind "Expose SSH" (the deployment-wide `hasSSHKey` flag), the SSH public key; unchecking "Expose SSH"
 * clears the key and its managed `SSH_PUBKEY` env var from every service.
 *
 * Container-VM constraints: a service running a managed SSH-VM image has its replica stepper pinned at a single instance
 * and no SSH controls here, because its key is required and lives in the Operating System card. While ANY service is a
 * VM, a sibling service's "Expose SSH" is forced on (checked and disabled), since unchecking it would strip the VM's key
 * too. A submit rejected on this card's fields marks the collapsed header, mirroring ExposePortsCard.
 */
export const RuntimeCard: FC<Props> = ({ serviceIndex, locked = false, dependencies: d = DEPENDENCIES }) => {
  const { control, formState } = useFormContext<SdlBuilderFormValuesType>();
  const services = useWatch({ control, name: "services" });
  const isVm = isVmImage(services?.[serviceIndex]?.image ?? "");
  const { isSubmitted } = formState;
  const serviceErrors = formState.errors.services?.[serviceIndex];
  const hasErrors = isSubmitted && !!(serviceErrors?.count || (!isVm && serviceErrors?.sshPubKey));

  return (
    <d.CollapsibleCard
      defaultOpen={false}
      locked={locked}
      title="Runtime"
      icon={<SettingsIcon className="h-4 w-4" />}
      infoTooltip={runtimeTooltip}
      className={hasErrors ? "border-destructive dark:border-destructive" : undefined}
    >
      <fieldset disabled={locked} className="flex min-w-0 flex-col gap-4 border-0 p-0">
        <ReplicasField serviceIndex={serviceIndex} dependencies={d} />

        {!isVm && <ExposeSshField serviceIndex={serviceIndex} dependencies={d} />}
      </fieldset>
    </d.CollapsibleCard>
  );
};

const ReplicasField: FC<Required<Omit<Props, "locked">>> = ({ serviceIndex, dependencies: d }) => {
  const { control, trigger } = useFormContext<SdlBuilderFormValuesType>();
  const count = useController({ control, name: `services.${serviceIndex}.count` });
  const image = useWatch({ control, name: `services.${serviceIndex}.image` });
  const isVm = isVmImage(image ?? "");

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
    <Field className="gap-2">
      <FieldLabel>Replicas</FieldLabel>
      <FieldContent>
        <d.QuantityStepper
          label="Replicas"
          className="self-start"
          value={count.field.value ?? 1}
          min={1}
          max={20}
          disabled={isVm}
          aria-describedby={count.fieldState.error ? `replicas-error-${serviceIndex}` : undefined}
          onChange={changeCount}
        />
        {isVm && <p className="text-sm text-muted-foreground">VMs run as a single instance.</p>}
        <FieldError id={`replicas-error-${serviceIndex}`} className="text-muted-foreground">
          {count.fieldState.error?.message}
        </FieldError>
      </FieldContent>
    </Field>
  );
};

const ExposeSshField: FC<Required<Omit<Props, "locked">>> = ({ serviceIndex, dependencies: d }) => {
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
